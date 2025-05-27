// script.js

const csvFile = 'project3_w_hba1c.csv';
const svg = d3.select('#violin'),
      margin = { top: 40, right: 30, bottom: 50, left: 60 },
      width = +svg.attr('width')  - margin.left - margin.right,
      height= +svg.attr('height') - margin.top  - margin.bottom,
      g = svg.append('g')
             .attr('transform', `translate(${margin.left},${margin.top})`);

// 核密度估计函数
function kernelEpanechnikov(k) {
  return v => Math.abs(v/=k) <=1 ? 0.75*(1 - v*v)/k : 0;
}
function kernelDensityEstimator(kernel, X) {
  return V => X.map(x => [x, d3.mean(V, v=>kernel(x - v))]);
}

d3.csv(csvFile, d => ({
  hba1c:       +d.HbA1c,
  delta:       +d.grow_in_glu   // 单位 mg/dL
}))
.then(data => {
  // 只保留 delta>0
  const pts = data.filter(d => !isNaN(d.delta) && d.delta > 0 && !isNaN(d.hba1c));

  // x 轴：HbA1c 连续
  const x = d3.scaleLinear()
              .domain(d3.extent(pts, d=>d.hba1c))
              .nice()
              .range([0, width]);

  // y 轴：delta 范围
  const y = d3.scaleLinear()
              .domain([0, d3.max(pts, d=>d.delta)])
              .nice()
              .range([height, 0]);

  // 分箱：20 箱
  const binGen = d3.bin()
                   .domain(x.domain())
                   .value(d=>d.hba1c)
                   .thresholds(20);

  const bins = binGen(pts);

  // 最大密度，用于宽度刻度
  // 先对每个 bin 做 KDE，记下 max density
  const kde = kernelDensityEstimator(kernelEpanechnikov( (y.domain()[1]-y.domain()[0])/20 ), y.ticks(50));
  bins.forEach(b => b.density = kde(b.map(d=>d.delta)) );
  const maxDensity = d3.max(bins, b => d3.max(b.density, dd => dd[1]));

  const widthScale = d3.scaleLinear()
                       .domain([0, maxDensity])
                       .range([0, x.step() * 0.9]);  // 最宽约箱宽的 90%

  // 画 x 轴
  g.append('g')
   .attr('class','axis')
   .attr('transform', `translate(0,${height})`)
   .call(d3.axisBottom(x));

  // 画 y 轴
  g.append('g')
   .attr('class','axis')
   .call(d3.axisLeft(y));

  // 绘制每个箱的小提琴
  bins.forEach(bin => {
    if (!bin.length) return; // 空箱跳过

    const binCenter = (bin.x0 + bin.x1)/2;
    const vd = bin.density; // [[y, density],...]

    // 上半轮廓 (从 min y->max y)
    const areaRight = d3.area()
      .x0(d => x(binCenter))
      .x1(d => x(binCenter) + widthScale(d[1]))
      .y(d => y(d[0]))
      .curve(d3.curveCatmullRom);

    // 下半轮廓 (从 max y->min y)
    const areaLeft = d3.area()
      .x0(d => x(binCenter))
      .x1(d => x(binCenter) - widthScale(d[1]))
      .y(d => y(d[0]))
      .curve(d3.curveCatmullRom);

    g.append('path')
     .datum(vd)
     .attr('class','violin')
     .attr('d', areaRight);

    g.append('path')
     .datum(vd)
     .attr('class','violin')
     .attr('d', areaLeft);
  });

  // 叠加散点
  g.append('g')
   .selectAll('circle')
   .data(pts)
   .join('circle')
     .attr('class','dot')
     .attr('cx', d=> x(d.hba1c) + (Math.random()-0.5)*x.step()*0.5)
     .attr('cy', d=> y(d.delta))
     .attr('r', 2);

  // 标题
  svg.append('text')
     .attr('x', margin.left + width/2)
     .attr('y', margin.top/2)
     .attr('text-anchor','middle')
     .attr('font-size','16px')
     .text('Violin Plot of 2-hr ΔGlucose vs. HbA1c');
})
.catch(err=>{
  console.error(err);
  alert('Failed to load or parse CSV. See console.');
});
