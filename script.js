/* script.js */
// 全局常量 & 容器设置
const margin = { top: 20, right: 20, bottom: 40, left: 50 };

// Violin Plot 容器
const violinSvg = d3.select('#violin'),
      vWidth   = +violinSvg.attr('width')  - margin.left - margin.right,
      vHeight  = +violinSvg.attr('height') - margin.top  - margin.bottom;
const vG = violinSvg.append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

// Boxplot 容器
const boxSvg = d3.select('#boxplot'),
      bWidth  = +boxSvg.attr('width')  - margin.left - margin.right,
      bHeight = +boxSvg.attr('height') - margin.top  - margin.bottom;
const bG = boxSvg.append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

// KDE 工具
function kernelDensityEstimator(kernel, x) {
  return values => x.map(xi => [ xi, d3.mean(values, v => kernel(xi - v)) ]);
}
function kernelEpanechnikov(k) {
  return v => {
    v = v / k;
    return Math.abs(v) <= 1 ? (0.75 * (1 - v * v)) / k : 0;
  };
}

// 载入并解析数据
d3.csv('project3_w_hba1c.csv', d => ({
  hba1c: +d.HbA1c,
  delta: +d.grow_in_glu,
  gender: d.Gender
})).then(data => {
  // === Violin Plot 部分 ===
  const hVals = data.map(d => d.hba1c).sort(d3.ascending);
  const t1 = d3.quantile(hVals, 1/3), t2 = d3.quantile(hVals, 2/3);
  data.forEach(d => d.group = d.hba1c <= t1 ? 'Low'
                                      : d.hba1c <= t2 ? 'Mid' : 'High');
  const vGroups = Array.from(
    d3.group(data, d => d.group),
    ([key, vals]) => ({ key, values: vals.map(d => d.delta) })
  );
  const allD = data.map(d => d.delta);
  const vX = d3.scaleBand()
    .domain(vGroups.map(d => d.key))
    .range([0, vWidth])
    .padding(0.5);
  const vY = d3.scaleLinear()
    .domain([d3.min(allD), d3.max(allD)]).nice()
    .range([vHeight, 0]);
  const kde = kernelDensityEstimator(kernelEpanechnikov(7), vY.ticks(60));

  vGroups.forEach(gp => {
    const density = kde(gp.values);
    const maxD = d3.max(density, d => d[1]);
    const xNum = d3.scaleLinear()
      .domain([0, maxD])
      .range([0, vX.bandwidth()/2]);
    const area = d3.area()
      .curve(d3.curveCatmullRom)
      .x0(d => vX(gp.key) + vX.bandwidth()/2 - xNum(d[1]))
      .x1(d => vX(gp.key) + vX.bandwidth()/2 + xNum(d[1]))
      .y(d => vY(d[0]));
    vG.append('path')
      .datum(density)
      .attr('class', 'violin')
      .attr('d', area);
  });
  vG.append('g')
    .attr('transform', `translate(0,${vHeight})`)
    .call(d3.axisBottom(vX));
  vG.append('g')
    .call(d3.axisLeft(vY));

  // === Boxplot 部分 ===
  const bGrouped = Array.from(
    d3.group(data, d => d.gender),
    ([key, vals]) => ({ key, values: vals.map(d => d.delta).sort(d3.ascending) })
  );
  const bSumm = bGrouped.map(d => {
    const arr = d.values;
    const q1 = d3.quantile(arr, 0.25),
          med = d3.quantile(arr, 0.5),
          q3 = d3.quantile(arr, 0.75);
    const iqr = q3 - q1;
    const lo = Math.max(d3.min(arr), q1 - 1.5 * iqr);
    const hi = Math.min(d3.max(arr), q3 + 1.5 * iqr);
    return { key: d.key, q1, med, q3, lo, hi };
  });
  const bX = d3.scaleBand()
    .domain(bSumm.map(d => d.key))
    .range([0, bWidth])
    .padding(0.4);
  const bY = d3.scaleLinear()
    .domain([d3.min(bSumm, d => d.lo), d3.max(bSumm, d => d.hi)]).nice()
    .range([bHeight, 0]);

  // whiskers
  bG.selectAll('.whisker')
    .data(bSumm)
    .join('line')
      .attr('class', 'whisker')
      .attr('x1', d => bX(d.key) + bX.bandwidth()/2)
      .attr('x2', d => bX(d.key) + bX.bandwidth()/2)
      .attr('y1', d => bY(d.lo))
      .attr('y2', d => bY(d.hi));
  // box
  bG.selectAll('.box')
    .data(bSumm)
    .join('rect')
      .attr('class', 'box')
      .attr('x', d => bX(d.key))
      .attr('y', d => bY(d.q3))
      .attr('width', bX.bandwidth())
      .attr('height', d => bY(d.q1) - bY(d.q3));
  // median
  bG.selectAll('.median')
    .data(bSumm)
    .join('line')
      .attr('class', 'median')
      .attr('x1', d => bX(d.key))
      .attr('x2', d => bX(d.key) + bX.bandwidth())
      .attr('y1', d => bY(d.med))
      .attr('y2', d => bY(d.med));

  bG.append('g')
    .attr('transform', `translate(0,${bHeight})`)
    .call(d3.axisBottom(bX));
  bG.append('g')
    .call(d3.axisLeft(bY));
});
