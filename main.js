// main.js

// 等待 DOM 完全加载后再执行各可视化函数
document.addEventListener('DOMContentLoaded', function() {
  drawHistogram();
  drawAgeTrend();
  drawRiskCurve();
  drawCaseExamples();
});

/* =========================================================================
   1. 人群 HbA1c 分布 —— 直方图
   ========================================================================= */
function drawHistogram() {
  d3.csv('data/hbA1c_population.csv', d => ({
    hbA1c: +d.hbA1c,
    age: +d.age,
    sex: d.sex,
    status: d.diagnosis_status
  })).then(data => {
    // 画布尺寸及边距
    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // 创建 SVG
    const svg = d3.select('#histogram')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // x 轴：HbA1c 值范围（假设最小为 4，最大为 10）
    const x = d3.scaleLinear()
      .domain([4, 10])
      .nice()
      .range([0, width]);

    // 生成 bins
    const histogram = d3.histogram()
      .value(d => d.hbA1c)
      .domain(x.domain())
      .thresholds(x.ticks(30));

    const bins = histogram(data);

    // y 轴：每个 bin 的计数
    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length)])
      .nice()
      .range([height, 0]);

    // 绘制柱状
    svg.selectAll('rect')
      .data(bins)
      .enter()
      .append('rect')
        .attr('x', d => x(d.x0) + 1)
        .attr('y', d => y(d.length))
        .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr('height', d => height - y(d.length))
        .attr('fill', '#69b3a2');

    // x 轴
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));

    // y 轴
    svg.append('g')
      .call(d3.axisLeft(y));

    // x 轴标签
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .text('HbA1c (%)');

    // y 轴标签
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .text('Count');
  });
}

/* =========================================================================
   2. HbA1c 随年龄变化趋势 —— 折线 + 滑块高亮
   ========================================================================= */
function drawAgeTrend() {
  d3.csv('data/age_hbA1c_trend.csv', d => ({
    age: +d.age_group,
    mean: +d.mean_hbA1c,
    std: +d.std_hbA1c
  })).then(data => {
    const margin = { top: 20, right: 60, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select('#lineChart')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // x 轴：年龄 20–80
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.age))
      .range([0, width]);

    // y 轴：HbA1c 数值
    const y = d3.scaleLinear()
      .domain([
        d3.min(data, d => d.mean - d.std) - 0.2,
        d3.max(data, d => d.mean + d.std) + 0.2
      ])
      .range([height, 0]);

    // 绘制折线
    const line = d3.line()
      .x(d => x(d.age))
      .y(d => y(d.mean))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#ff7f0e')
      .attr('stroke-width', 2)
      .attr('d', line);

    // 绘制误差带（±1 std）
    const area = d3.area()
      .x(d => x(d.age))
      .y0(d => y(d.mean - d.std))
      .y1(d => y(d.mean + d.std))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('fill', '#ff7f0e')
      .attr('opacity', 0.2)
      .attr('d', area);

    // x 轴
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(7));
    // y 轴
    svg.append('g')
      .call(d3.axisLeft(y));

    // x 轴标签
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .text('Age (Years)');

    // y 轴标签
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .text('Mean HbA1c (%)');

    // 滑块 & 高亮点
    const ageSlider = d3.select('#ageSlider');
    const ageValueLabel = d3.select('#ageValue');

    ageSlider
      .attr('min', d3.min(data, d => d.age))
      .attr('max', d3.max(data, d => d.age))
      .attr('value', d3.min(data, d => d.age));

    const focusCircle = svg.append('circle')
      .attr('r', 6)
      .attr('fill', 'steelblue')
      .style('opacity', 0);

    function updateAge(ageChosen) {
      const record = data.find(d => d.age === +ageChosen);
      if (!record) return;
      focusCircle
        .attr('cx', x(record.age))
        .attr('cy', y(record.mean))
        .style('opacity', 1);
      ageValueLabel.text(ageChosen);
    }

    ageSlider.on('input', function() {
      const ageChosen = this.value;
      updateAge(ageChosen);
    });

    // 初始高亮
    updateAge(d3.min(data, d => d.age));
  });
}

/* =========================================================================
   3. HbA1c 与糖尿病风险 —— 散点 + 连线 + Tooltip
   ========================================================================= */
function drawRiskCurve() {
  d3.csv('data/risk_model_data.csv', d => ({
    hbA1c: +d.hbA1c,
    prob: +d.risk_prob
  })).then(data => {
    const margin = { top: 20, right: 60, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select('#riskCurve')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // x 轴：HbA1c
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.hbA1c))
      .range([0, width]);

    // y 轴：概率 0–1
    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([height, 0]);

    // 绘制散点
    svg.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
        .attr('cx', d => x(d.hbA1c))
        .attr('cy', d => y(d.prob))
        .attr('r', 4)
        .attr('fill', '#d62728');

    // 绘制连线
    const line = d3.line()
      .x(d => x(d.hbA1c))
      .y(d => y(d.prob))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#1f77b4')
      .attr('stroke-width', 2)
      .attr('d', line);

    // x 轴
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));
    // y 轴
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5));

    // x 轴标签
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .text('HbA1c (%)');

    // y 轴标签
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .text('Risk Probability');

    // Tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip');

    svg.selectAll('circle')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 6).attr('fill', '#ff7f0e');
        tooltip
          .html(`HbA1c: ${d.hbA1c.toFixed(1)}%<br>Risk: ${(d.prob * 100).toFixed(1)}%`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 30) + 'px')
          .style('opacity', 1);
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 4).attr('fill', '#d62728');
        tooltip.style('opacity', 0);
      });
  });
}

/* =========================================================================
   4. 个体案例模拟 —— 多条折线 & 图例
   ========================================================================= */
function drawCaseExamples() {
  d3.csv('data/case_examples.csv', d => ({
    person: d.person_id,
    t: +d.time_point,
    hbA1c: +d.hbA1c,
    state: d.state_level
  })).then(data => {
    // 按 person 分组
    const nested = d3.group(data, d => d.person);

    const margin = { top: 20, right: 100, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select('#caseCharts')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // x 轴：time_point (0,6,12,18)
    const allTime = [...new Set(data.map(d => d.t))];
    const x = d3.scalePoint()
      .domain(allTime.sort((a, b) => a - b))
      .range([0, width]);

    // y 轴：HbA1c 数值
    const y = d3.scaleLinear()
      .domain([
        d3.min(data, d => d.hbA1c) - 0.2,
        d3.max(data, d => d.hbA1c) + 0.2
      ])
      .range([height, 0]);

    // 颜色：不同 person
    const color = d3.scaleOrdinal(d3.schemeCategory10)
      .domain(Array.from(nested.keys()));

    // 绘制每条折线及节点
    const line = d3.line()
      .x(d => x(d.t))
      .y(d => y(d.hbA1c))
      .curve(d3.curveStepAfter);

    for (const [person, records] of nested.entries()) {
      svg.append('path')
        .datum(records.sort((a, b) => a.t - b.t))
        .attr('fill', 'none')
        .attr('stroke', color(person))
        .attr('stroke-width', 2)
        .attr('d', line);

      svg.selectAll(`.point-${person}`)
        .data(records)
        .enter()
        .append('circle')
          .attr('class', `point-${person}`)
          .attr('cx', d => x(d.t))
          .attr('cy', d => y(d.hbA1c))
          .attr('r', 4)
          .attr('fill', color(person))
          .attr('stroke', d => {
            if (d.state === 'normal') return 'green';
            if (d.state === 'prediabetes') return 'orange';
            if (d.state === 'diabetes') return 'red';
          })
          .attr('stroke-width', 2);
    }

    // 坐标轴
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => `${d} mo`));
    svg.append('g')
      .call(d3.axisLeft(y));

    // 图例
    const legend = svg.append('g')
      .attr('transform', `translate(${width + 20},20)`);
    Array.from(nested.keys()).forEach((person, i) => {
      const yOffset = i * 20;
      legend.append('rect')
        .attr('x', 0)
        .attr('y', yOffset)
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', color(person));
      legend.append('text')
        .attr('x', 15)
        .attr('y', yOffset + 9)
        .text(`Person ${person}`)
        .attr('font-size', '12px');
    });

    // x 轴标签
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .text('Time (months)');

    // y 轴标签
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .text('HbA1c (%)');
  });
}
