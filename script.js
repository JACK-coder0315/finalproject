// script.js

// —— 配置 ——
// CSV 文件名（确保和 index.html 在同一目录下）
const csvFile = 'project3_w_hba1c.csv';

// HbA1c 三档阈值
const hba1cThresholds = { low: 5.7, medium: 6.5 };

// 要展示的特征列表：key 对应 data 上的属性，label 用于下拉菜单显示
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
  // 直接读取各字段
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
  // 1. 过滤：去掉 grow_in_glu 缺失或非正值的行
  const data = raw.filter(d => !isNaN(d.grow_in_glu) && d.grow_in_glu > 0);

  // 2. 计算衍生特征 & HbA1c 分组
  data.forEach(d => {
    // 固定用 2 小时来计算上升速率
    d.rise_rate     = d.grow_in_glu / 2;
    d.carb_density  = d.total_carb    / d.calorie;
    d.sugar_density = d.sugar         / d.calorie;
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

  // 4. 准备画布与坐标轴
  const svg = d3.select('#chart'),
        margin = { top: 30, right: 20, bottom: 40, left: 50 },
        W = +svg.attr('width')  - margin.left - margin.right,
        H = +svg.attr('height') - margin.top  - margin.bottom,
        g = svg.append('g')
               .attr('transform', `translate(${margin.left},${margin.top})`);

  // x 轴：固定三个分类
  const xScale = d3.scalePoint()
                   .domain(['low','medium','high'])
                   .range([0, W])
                   .padding(0.5);

  // y 轴 scale，会在 draw 时更新 domain
  const yScale = d3.scaleLinear().range([H, 0]);
  const yAxisG = g.append('g');

  // 绘制 x 轴
  g.append('g')
   .attr('transform', `translate(0,${H})`)
   .call(d3.axisBottom(xScale));

  // 5. 绘制箱线图函数
  function drawBoxplot(featureKey) {
    // 5.1 更新 y 轴 domain
    const maxVal = d3.max(data, d => d[featureKey]);
    yScale.domain([0, maxVal]).nice();
    yAxisG.call(d3.axisLeft(yScale));

    // 5.2 按 HbA1c 分组
    const grouped = d3.group(data, d => d.hba1c_cat);

    // 清除旧图形
    g.selectAll('.boxplot').remove();

    // 5.3 对每个分组绘制箱线
    for (const [cat, arr] of grouped) {
      const vals  = arr.map(d => d[featureKey]).sort(d3.ascending);
      const q1    = d3.quantile(vals, 0.25),
            mid   = d3.quantile(vals, 0.5),
            q3    = d3.quantile(vals, 0.75),
            iqr   = q3 - q1,
            min   = Math.max(d3.min(vals), q1 - 1.5 * iqr),
            max   = Math.min(d3.max(vals), q3 + 1.5 * iqr),
            cx    = xScale(cat);

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
       .attr('y1', yScale(mid)).attr('y2', yScale(mid));

      // 上须、端点
      [[max, q3], [min, q1]].forEach(([v1, v2]) => {
        g.append('line')
         .attr('class','boxplot median')
         .attr('x1', cx).attr('x2', cx)
         .attr('y1', yScale(v1)).attr('y2', yScale(v2));
        g.append('line')
         .attr('class','boxplot median')
         .attr('x1', cx - 10).attr('x2', cx + 10)
         .attr('y1', yScale(v1)).attr('y2', yScale(v1));
      });
    }
  }

  // 初始渲染
  drawBoxplot(features[0].key);
})
.catch(err => {
  console.error('CSV load or parse error:', err);
  alert('Failed to load CSV — see console for details.');
});
