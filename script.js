// script.js

const csvFile = 'project3_w_hba1c.csv';

const svg = d3.select('#violin'),
      margin = { top: 40, right: 30, bottom: 50, left: 60 },
      width  = +svg.attr('width')  - margin.left - margin.right,
      height = +svg.attr('height') - margin.top  - margin.bottom,
      g = svg.append('g')
             .attr('transform', `translate(${margin.left},${margin.top})`);

// Epanechnikov 核函数
function kernelEpanechnikov(bw) {
  return v => Math.abs(v /= bw) <= 1 ? 0.75 * (1 - v * v) / bw : 0;
}
// KDE 估计器
function kernelDensityEstimator(kernel, X) {
  return V => X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
}

d3.csv(csvFile, d => ({
  hba1c: +d.HbA1c,
  delta: +d.grow_in_glu
}))
.then(data => {
  // 只保留正值
  const pts = data.filter(d => d.delta > 0 && !isNaN(d.hba1c));

  // 1. x 轴：HbA1c 连续刻度
  const x = d3.scaleLinear()
              .domain(d3.extent(pts, d => d.hba1c))
              .nice()
              .range([0, width]);

  // 2. y 轴：delta 刻度
  const y = d3.scaleLinear()
              .domain([0, d3.max(pts, d => d.delta)])
              .nice()
              .range([height, 0]);

  // 3. 按 HbA1c 分成 20 个 bin
  const binGen = d3.bin()
                   .domain(x.domain())
                   .value(d => d.hba1c)
                   .thresholds(20);

  const bins = binGen(pts);

  // 4. 计算 bin 的像素宽度
  //    用 bin[0].x0/x1 映射到像素，求差值
  let binWidth = 0;
  if (bins.length > 0 && bins[0].x1 != null) {
    binWidth = x(bins[0].x1) - x(bins[0].x0);
  }

  // 5. KDE 带宽：以 delta 轴范围 / 20 为例
  const bw = (y.domain()[0] === y.domain()[1]) 
             ? 1 
             : (y.domain()[1] - y.domain()[0]) / 20;

  const kde = kernelDensityEstimator(
    kernelEpanechnikov(bw),
    y.ticks(50)
  );

  // 为每个 bin 计算 density 数组
  bins.forEach(b => {
    b.density = kde(b.map(d => d.delta));
  });

  // 找到最大 density，用于归一化宽度
  const maxDensity = d3.max(bins, b => d3.max(b.density, dd => dd[1])) || 1;

  // 宽度比例尺：[0, maxDensity] → [0, binWidth*0.9]
  const widthScale = d3.scaleLinear()
                       .domain([0, maxDensity])
                       .range([0, binWidth * 0.9]);

  // 6. 绘坐标轴
  g.append('g')
   .attr('class', 'axis')
   .attr('transform', `translate(0,${height})`)
   .call(d3.axisBottom(x));

  g.append('g')
   .attr('class', 'axis')
   .call(d3.axisLeft(y));

  // 7. 绘制小提琴
  bins.forEach(bin => {
    if (!bin.length) return;  // 空 bin 跳过

    const center = (bin.x0 + bin.x1) / 2;
    const vd     = bin.density;  // [[y, density], ...]

    // 右侧轮廓
    const areaR = d3.area()
      .x0(() => x(center))
      .x1(d => x(center) + widthScale(d[1]))
      .y(d => y(d[0]))
      .curve(d3.curveCatmullRom);

    // 左侧轮廓
    const areaL = d3.area()
      .x0(() => x(center))
      .x1(d => x(center) - widthScale(d[1]))
      .y(d => y(d[0]))
      .curve(d3.curveCatmullRom);

    g.append('path')
     .datum(vd)
     .attr('class', 'violin')
     .attr('d', areaR);

    g.append('path')
     .datum(vd)
     .attr('class', 'violin')
     .attr('d', areaL);
  });

  // 8. 叠加散点（jitter = binWidth*0.5）
  g.append('g')
   .selectAll('circle')
   .data(pts)
   .join('circle')
     .attr('class', 'dot')
     .attr('cx', d => x(d.hba1c) + (Math.random() - 0.5) * binWidth * 0.5)
     .attr('cy', d => y(d.delta))
     .attr('r', 2);

  // 9. 标题
  svg.append('text')
     .attr('x', margin.left + width / 2)
     .attr('y', margin.top / 2)
     .attr('text-anchor', 'middle')
     .attr('font-size', '16px')
     .text('Violin Plot of 2-hr ΔGlucose vs. HbA1c');
})
.catch(err => {
  console.error('Error loading CSV:', err);
  alert('Failed to load CSV—check console.');
});
