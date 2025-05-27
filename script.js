// —— 全局常量 ——
const svg = d3.select("svg"),
      margin = { top: 20, right: 20, bottom: 40, left: 50 },
      width  = +svg.attr("width")  - margin.left - margin.right,
      height = +svg.attr("height") - margin.top  - margin.bottom;

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// 载入并解析 CSV
d3.csv("project3_w_hba1c.csv", d => ({
  hba1c: +d.HbA1c,
  delta: +d.grow_in_glu
})).then(data => {
  // 1) 按三分位数划分 HbA1c 分组
  const hbaVals = data.map(d => d.hba1c).sort(d3.ascending);
  const t1 = d3.quantile(hbaVals, 1/3),
        t2 = d3.quantile(hbaVals, 2/3);
  data.forEach(d => {
    if      (d.hba1c <= t1) d.group = "Low";
    else if (d.hba1c <= t2) d.group = "Mid";
    else                    d.group = "High";
  });

  // 2) 构造分组数据
  const groups = Array.from(
    d3.group(data, d => d.group),
    ([key, vals]) => ({ key, values: vals.map(d => d.delta) })
  );

  // 3) 设定比例尺
  const x = d3.scaleBand()
    .domain(groups.map(d => d.key))
    .range([0, width])
    .padding(0.5);

  // y 轴范围：根据所有 delta 值
  const allDeltas = data.map(d => d.delta);
  const y = d3.scaleLinear()
    .domain([d3.min(allDeltas), d3.max(allDeltas)])
    .nice()
    .range([height, 0]);

  // KDE 相关
  const kde = kernelDensityEstimator(kernelEpanechnikov(7), y.ticks(60));

  // 绘制每个组的小提琴
  groups.forEach(group => {
    const density = kde(group.values);
    const maxDensity = d3.max(density, d => d[1]);

    // 横向密度尺：映射密度到半个带宽
    const xNum = d3.scaleLinear()
      .domain([0, maxDensity])
      .range([0, x.bandwidth() / 2]);

    // area 生成器
    const area = d3.area()
      .curve(d3.curveCatmullRom)
      .x0(d => x(group.key) + x.bandwidth()/2 - xNum(d[1]))
      .x1(d => x(group.key) + x.bandwidth()/2 + xNum(d[1]))
      .y(d => y(d[0]));

    g.append("path")
      .datum(density)
      .attr("class", "violin")
      .attr("d", area);
  });

  // 添加坐标轴
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));
  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));
});


// —— KDE 工具函数 ——
function kernelDensityEstimator(kernel, x) {
  return values => x.map(xi => [ xi, d3.mean(values, v => kernel(xi - v)) ]);
}

function kernelEpanechnikov(k) {
  return v => {
    v = v / k;
    return Math.abs(v) <= 1 ? (0.75 * (1 - v * v)) / k : 0;
  };
}
