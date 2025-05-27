// —— 配置 ——
// CSV 文件名
const csvFile = 'project3_w_hba1c.csv';
// HbA1c 阈值
const hba1cThresholds = { low: 5.7, medium: 6.5 };

// 要展示的特征列表
const features = [
  { key: 'rise_rate',     label: 'Rise Rate (mg/dL·h⁻¹)' },
  { key: 'carb_density',  label: 'Carb Density (g/kcal)' },
  { key: 'sugar_density', label: 'Sugar Density (g/kcal)' },
  { key: 'fiber_ratio',   label: 'Fiber Ratio' },
  { key: 'protein_ratio', label: 'Protein Ratio (g/kcal)' },
  { key: 'fat_ratio',     label: 'Fat Ratio (g/kcal)' }
];

// —— 主流程 —— 
d3.csv(csvFile, d => ({
  time_diff:     +d['time_diff(hr)'],
  grow_in_glu:   +d.grow_in_glu,
  calorie:       +d.calorie,
  total_carb:    +d.total_carb,
  dietary_fiber: +d.dietary_fiber,
  sugar:         +d.sugar,
  protein:       +d.protein,
  total_fat:     +d.total_fat,
  hba1c:         +d.HbA1c
}))
.then(raw => {
  // 1. 过滤：只保留 0<time_diff≤1 小时的数据
  const data = raw.filter(d => d.time_diff > 0 && d.time_diff <= 1);

  // 2. 计算衍生特征 & HbA1c 分组
  data.forEach(d => {
    d.rise_rate     = d.grow_in_glu / d.time_diff;
    d.carb_density  = d.total_carb    / d.calorie;
    d.sugar_density = d.sugar         / d.calorie;
    // 避免 total_carb=0 导致 NaN
    d.fiber_ratio   = d.total_carb > 0
                        ? d.dietary_fiber / d.total_carb
                        : 0;
    d.protein_ratio = d.protein       / d.calorie;
    d.fat_ratio     = d.total_fat     / d.calorie;
    d.hba1c_cat     = d.hba1c < hba1cThresholds.low
                       ? 'low'
                       : (d.hba1c < hba1cThresholds.medium
                          ? 'medium'
                          : 'high');
  });

  // 3. 填充下拉菜单
  const select = d3.select('#feature-select');
  select.selectAll('option')
    .data(features)
    .join('option')
      .attr('value', f => f.key)
      .text(f => f.label);
  select.on('change', () => drawBoxplot(select.property('value')));
  select.property('value', features[0].key);

  // 4. 设置画布与坐标轴
  const svg = d3.select('#chart'),
        margin = { top: 30, right: 20, bottom: 40, left: 50 },
        W = +svg.attr('width')  - margin.left - margin.right,
        H = +svg.attr('height') - margin.top  - margin.bottom,
        g = svg.append('g')
               .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scalePoint()
                   .domain(['low','medium','high'])
                   .range([0, W])
                   .padding(0.5);

  // 初始 yScale（会在绘图时动态更新）
  const yScale = d3.scaleLinear().range([H, 0]);
  const yAxisG = g.append('g');

  // 绘制 x 轴
  g.append('g')
   .attr('transform', `translate(0,${H})`)
   .call(d3.axisBottom(xScale));

  // 5. 箱线图绘制函数
  function drawBoxplot(featureKey) {
    // 5.1 更新 y 轴域
    const maxVal = d3.max(data, d => d[featureKey]);
    yScale.domain([0, maxVal]).nice();
    yAxisG.call(d3.axisLeft(yScale));

    // 5.2 按 HbA1c 分组
    const grouped = d3.group(data, d => d.hba1c_cat);

    // 清除旧图
    g.selectAll('.boxplot').remove();

    // 5.3 逐组绘制箱线
    for (const [cat, arr] of grouped) {
      const values = arr.map(d => d[featureKey]).sort(d3.ascending);
      const q1     = d3.quantile(values, 0.25);
      const median = d3.quantile(values, 0.5);
      const q3     = d3.quantile(values, 0.75);
      const iqr    = q3 - q1;
      const min    = Math.max(d3.min(values), q1 - 1.5 * iqr);
      const max    = Math.min(d3.max(values), q3 + 1.5 * iqr);
      const cx     = xScale(cat);

      // 箱体
      g.append('rect')
       .attr('class','boxplot')
       .attr('x', cx - 15)
       .attr('y', yScale(q3))
       .attr('width', 30)
       .attr('height', Math.max(0, yScale(q1) - yScale(q3)));

      // 中位线
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx - 15).attr('x2', cx + 15)
       .attr('y1', yScale(median)).attr('y2', yScale(median));

      // 须
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx).attr('x2', cx)
       .attr('y1', yScale(max)).attr('y2', yScale(q3));
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx - 10).attr('x2', cx + 10)
       .attr('y1', yScale(max)).attr('y2', yScale(max));
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx).attr('x2', cx)
       .attr('y1', yScale(min)).attr('y2', yScale(q1));
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx - 10).attr('x2', cx + 10)
       .attr('y1', yScale(min)).attr('y2', yScale(min));
    }
  }

  // 初次渲染
  drawBoxplot(features[0].key);
})
.catch(err => {
  console.error('CSV 加载或处理错误：', err);
  alert('CSV 加载失败，详情查看控制台。');
});
