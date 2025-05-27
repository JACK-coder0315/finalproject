// —— 配置 ——
// 1. CSV 文件名
const csvFile = 'project3_w_hba1c.csv';
// 2. HbA1c 分档阈值
const hba1cThresholds = { low: 5.7, medium: 6.5 };

// —— 特征列表 ——
// key 对应计算后对象上的属性名，label 用于下拉菜单显示
const features = [
  { key: 'rise_rate',      label: 'Rise Rate (mg/dL·h⁻¹)' },
  { key: 'carb_density',   label: 'Carb Density (g/kcal)' },
  { key: 'sugar_density',  label: 'Sugar Density (g/kcal)' },
  { key: 'fiber_ratio',    label: 'Fiber Ratio' },
  { key: 'protein_ratio',  label: 'Protein Ratio' },
  { key: 'fat_ratio',      label: 'Fat Ratio' }
];

// —— 主流程 —— 
d3.csv(csvFile, d => ({
  // 原始字段
  time_diff:    +d['time_diff(hr)'],
  grow_in_glu:  +d.grow_in_glu,
  calorie:      +d.calorie,
  total_carb:   +d.total_carb,
  dietary_fiber:+d.dietary_fiber,
  sugar:        +d.sugar,
  protein:      +d.protein,
  total_fat:    +d.total_fat,
  hba1c:        +d.HbA1c
}))
.then(raw => {
  // 1. 过滤“餐后1小时内”的记录
  const data = raw.filter(d => d.time_diff <= 1);

  // 2. 计算衍生特征 & HbA1c 分组
  data.forEach(d => {
    d.rise_rate     = d.grow_in_glu / d.time_diff;
    d.carb_density  = d.total_carb    / d.calorie;
    d.sugar_density = d.sugar         / d.calorie;
    d.fiber_ratio   = d.dietary_fiber / d.total_carb;
    d.protein_ratio = d.protein       / d.calorie;
    d.fat_ratio     = d.total_fat     / d.calorie;
    d.hba1c_cat     = d.hba1c < hba1cThresholds.low
                       ? 'low'
                       : (d.hba1c < hba1cThresholds.medium ? 'medium' : 'high');
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

  const yScale = d3.scaleLinear()
                   .domain([
                     0,
                     d3.max(data, d => d3.max(features, f => d[f.key]))
                   ]).nice()
                   .range([H, 0]);

  g.append('g')
   .attr('transform', `translate(0,${H})`)
   .call(d3.axisBottom(xScale));

  const yAxisG = g.append('g')
                  .call(d3.axisLeft(yScale));

  // 5. 绘制箱线图函数
  function drawBoxplot(featureKey) {
    // 更新 y 轴域：根据当前特征重新缩放
    const maxVal = d3.max(data, d => d[featureKey]);
    yScale.domain([0, maxVal]).nice();
    yAxisG.call(d3.axisLeft(yScale));

    // 分组：low/medium/high
    const grouped = d3.group(data, d => d.hba1c_cat);

    // 清除旧图
    g.selectAll('.boxplot').remove();

    // 逐组绘制
    Array.from(grouped).forEach(([cat, arr]) => {
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
       .attr('height', yScale(q1) - yScale(q3));

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
    });
  }

  // 初次渲染
  drawBoxplot(features[0].key);
})
.catch(err => {
  console.error('CSV load or parse error:', err);
  alert('Failed to load CSV — see console for details.');
});
