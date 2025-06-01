// main.js

// 等待 DOM 完全加载后执行
document.addEventListener('DOMContentLoaded', () => {
  // 读取原始 Kaggle 数据
  d3.csv('data/diabetes_prediction_dataset.csv', d => ({
    gender: d.gender,
    age: +d.age,
    hypertension: +d.hypertension,
    heart_disease: +d.heart_disease,
    smoking_history: d.smoking_history,
    bmi: +d.bmi,
    hbA1c: +d.HbA1c_level,
    blood_glucose: +d.blood_glucose_level,
    diabetes: +d.diabetes
  })).then(rawData => {
    // 为每条记录添加 status（HbA1c 状态）和 ageDecade
    rawData.forEach(d => {
      if (d.hbA1c < 5.7) d.status = 'normal';
      else if (d.hbA1c < 6.5) d.status = 'prediabetes';
      else d.status = 'diabetes';
      const decade = Math.floor(d.age / 10) * 10;
      d.ageDecade = `${decade}–${decade + 9}`;
    });

    // 执行各个可视化函数
    drawHistogram(rawData);
    drawAgeTrend(rawData);
    drawRiskCurve(rawData);
    // 如果不需要箱线＋小提琴图组合，就直接注释掉下面这一行：
    // drawViolinBoxPlot(rawData);
  }).catch(error => {
    console.error('加载 diabetes_prediction_dataset.csv 出错：', error);
  });
});



/* =========================================================================
   1. 人群 HbA1c 分布 —— 动态直方图
   说明：
   - 初始每个柱子从底部“长出”；
   - 自动循环展示：all → normal → prediabetes → diabetes → all。
   ========================================================================= */
function drawHistogram(data) {
  const margin = { top: 20, right: 30, bottom: 30, left: 40 };
  const width = 800 - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = d3.select('#histogram')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // 各分类数据
  const dataAll = data;
  const dataNormal = data.filter(d => d.status === 'normal');
  const dataPre = data.filter(d => d.status === 'prediabetes');
  const dataDia = data.filter(d => d.status === 'diabetes');

  // x 轴刻度范围
  const xDomain = [
    d3.min(dataAll, d => d.hbA1c) - 0.5,
    d3.max(dataAll, d => d.hbA1c) + 0.5
  ];
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([0, width]);

  // histogram 生成器
  const histogramGen = d3.histogram()
    .value(d => d.hbA1c)
    .domain(x.domain())
    .thresholds(x.ticks(30));

  const binsAll = histogramGen(dataAll);
  const binsNor = histogramGen(dataNormal);
  const binsPre = histogramGen(dataPre);
  const binsDia = histogramGen(dataDia);

  // 初始使用所有数据的 bins
  let currentBins = binsAll;

  // y 轴 scale
  const y = d3.scaleLinear()
    .domain([0, d3.max(binsAll, d => d.length)])
    .range([height, 0]);

  // 绘制 x 轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // 绘制 y 轴
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y));

  // Tooltip
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  // 创建初始矩形（柱子）
  const rects = svg.selectAll('rect')
    .data(currentBins)
    .enter()
    .append('rect')
      .attr('x', d => x(d.x0) + 1)
      .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', '#69b3a2');

  // 鼠标交互
  rects
    .on('mouseover', function (event, d) {
      d3.select(this).attr('fill', '#ff7f0e');
      tooltip
        .html(`Range: ${d.x0.toFixed(1)}–${d.x1.toFixed(1)}<br>Count: ${d.length}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 30) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function () {
      d3.select(this).attr('fill', '#69b3a2');
      tooltip.style('opacity', 0);
    });

  // 初始过渡：让柱子“从底部长出”
  rects.transition()
    .duration(1200)
    .attr('y', d => y(d.length))
    .attr('height', d => height - y(d.length));

  // 分类顺序循环：all → normal → prediabetes → diabetes → all
  const categories = [
    { name: 'all', bins: binsAll },
    { name: 'normal', bins: binsNor },
    { name: 'prediabetes', bins: binsPre },
    { name: 'diabetes', bins: binsDia }
  ];
  let idx = 0;

  d3.interval(() => {
    idx = (idx + 1) % categories.length;
    updateHistogram(categories[idx].bins);
  }, 2500);

  // 更新函数：更新 y 轴和柱子高度
  function updateHistogram(nextBins) {
    y.domain([0, d3.max(nextBins, d => d.length)]).nice();
    yAxis.transition().duration(800).call(d3.axisLeft(y));

    svg.selectAll('rect')
      .data(nextBins)
      .transition()
      .duration(800)
      .attr('y', d => y(d.length))
      .attr('height', d => height - y(d.length));
  }
}



/* =========================================================================
   2. HbA1c 随年龄变化趋势 —— 带动态动画的折线图 + 自动滑块
   ========================================================================= */
function drawAgeTrend(data) {
  // 计算每个整数年龄的 mean 与 std
  const ageGroups = d3.rollups(
    data,
    v => {
      const arr = v.map(d => d.hbA1c);
      return {
        mean: d3.mean(arr),
        std: d3.deviation(arr) || 0
      };
    },
    d => Math.floor(d.age)
  );
  const ageTrend = ageGroups.map(([age, stats]) => ({
    age: age,
    mean: stats.mean,
    std: stats.std
  })).sort((a, b) => a.age - b.age);

  const margin = { top: 20, right: 60, bottom: 40, left: 50 };
  const width = 800 - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = d3.select('#lineChart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // x 轴：年龄
  const x = d3.scaleLinear()
    .domain(d3.extent(ageTrend, d => d.age))
    .range([0, width]);

  // y 轴：平均 HbA1c ± std
  const y = d3.scaleLinear()
    .domain([
      d3.min(ageTrend, d => d.mean - d.std) - 0.2,
      d3.max(ageTrend, d => d.mean + d.std) + 0.2
    ])
    .range([height, 0]);

  // 折线与误差带定义
  const line = d3.line()
    .x(d => x(d.age))
    .y(d => y(d.mean))
    .curve(d3.curveMonotoneX);

  const area = d3.area()
    .x(d => x(d.age))
    .y0(d => y(d.mean - d.std))
    .y1(d => y(d.mean + d.std))
    .curve(d3.curveMonotoneX);

  // 绘制折线并添加描边动画
  const path = svg.append('path')
    .datum(ageTrend)
    .attr('fill', 'none')
    .attr('stroke', '#ff7f0e')
    .attr('stroke-width', 2)
    .attr('d', line);

  const totalLength = path.node().getTotalLength();
  path
    .attr('stroke-dasharray', totalLength + ' ' + totalLength)
    .attr('stroke-dashoffset', totalLength)
    .transition()
    .duration(1500)
    .attr('stroke-dashoffset', 0);

  // 绘制误差带（先隐藏，稍后淡入）
  const areaPath = svg.append('path')
    .datum(ageTrend)
    .attr('fill', '#ff7f0e')
    .attr('opacity', 0)
    .attr('d', area);

  areaPath
    .transition().delay(800).duration(800)
    .attr('opacity', 0.2);

  // 坐标轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(7));
  svg.append('g')
    .call(d3.axisLeft(y));

  // 轴标签
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .text('Age (Years)');
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .text('Mean HbA1c (%)');

  // 滑块 & 高亮点
  const ageSlider = d3.select('#ageSlider');
  const ageValueLabel = d3.select('#ageValue');

  const ages = ageTrend.map(d => d.age);
  ageSlider
    .attr('min', d3.min(ages))
    .attr('max', d3.max(ages))
    .attr('value', d3.min(ages));

  const focusCircle = svg.append('circle')
    .attr('r', 6)
    .attr('fill', 'steelblue')
    .style('opacity', 0);

  function updateAge(chosenAge) {
    const rec = ageTrend.find(d => d.age === +chosenAge);
    if (!rec) return;
    focusCircle
      .attr('cx', x(rec.age))
      .attr('cy', y(rec.mean))
      .style('opacity', 1);
    ageValueLabel.text(chosenAge);
  }

  let autoTimer;
  function startAutoPlay() {
    let i = 0;
    autoTimer = d3.interval(() => {
      const idx = i % ages.length;
      const chosen = ages[idx];
      ageSlider.property('value', chosen);
      updateAge(chosen);
      i++;
    }, 300);
  }

  ageSlider.on('mousedown', () => {
    if (autoTimer) autoTimer.stop();
  });

  ageSlider.on('input', function () {
    updateAge(this.value);
  });

  // 初始绘制 & 自动播放
  updateAge(d3.min(ages));
  startAutoPlay();
}



/* =========================================================================
   3. HbA1c vs. Diabetes Risk Curve —— 动态散点 + 描边曲线 + 网格线淡入 + Tooltip
   ========================================================================= */
function drawRiskCurve(data) {
  // 将 HbA1c 四舍五入到 0.1
  data.forEach(d => {
    d.hbA1cRound = Math.round(d.hbA1c * 10) / 10;
  });

  // 按四舍五入后的 HbA1c 分组，计算 diabetes == 1 的比例
  const riskGroups = d3.rollups(
    data,
    v => v.filter(d => d.diabetes === 1).length / v.length,
    d => d.hbA1cRound
  );
  const riskData = riskGroups.map(([hb, prob]) => ({
    hbA1c: hb,
    risk_prob: prob
  })).sort((a, b) => a.hbA1c - b.hbA1c);

  const margin = { top: 20, right: 60, bottom: 40, left: 50 };
  const width = 800 - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = d3.select('#riskCurve')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // x 轴：HbA1c 值
  const x = d3.scaleLinear()
    .domain(d3.extent(riskData, d => d.hbA1c))
    .range([0, width]);

  // y 轴：概率 0–1
  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0]);

  // 背景网格线（先隐藏）
  const yGrid = d3.axisLeft(y)
    .tickSize(-width)
    .tickFormat('')
    .ticks(5);

  const gridGroup = svg.append('g')
    .attr('class', 'grid-line')
    .attr('opacity', 0)
    .call(yGrid);

  // 绘制坐标轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  svg.append('g')
    .call(d3.axisLeft(y).ticks(5));

  // 轴标签
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .text('HbA1c (%)');
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

  // 绘制散点，初始半径 r = 0，逐个“长出”
  const circles = svg.selectAll('circle')
    .data(riskData)
    .enter()
    .append('circle')
      .attr('cx', d => x(d.hbA1c))
      .attr('cy', d => y(d.risk_prob))
      .attr('r', 0)
      .attr('fill', '#d62728');

  circles.transition()
    .delay((d, i) => i * 30)
    .duration(500)
    .attr('r', 4);

  // 绘制连线（先隐藏，通过描边动画再显现）
  const line = d3.line()
    .x(d => x(d.hbA1c))
    .y(d => y(d.risk_prob))
    .curve(d3.curveMonotoneX);

  const riskPath = svg.append('path')
    .datum(riskData)
    .attr('fill', 'none')
    .attr('stroke', '#1f77b4')
    .attr('stroke-width', 2)
    .attr('d', line)
    .attr('stroke-dasharray', function() {
      return this.getTotalLength() + ' ' + this.getTotalLength();
    })
    .attr('stroke-dashoffset', function() {
      return this.getTotalLength();
    });

  // 连线描边动画
  riskPath.transition()
    .delay(riskData.length * 30 + 200)
    .duration(1200)
    .attr('stroke-dashoffset', 0);

  // 网格线淡入
  gridGroup.transition()
    .delay(riskData.length * 30 + 800)
    .duration(800)
    .attr('opacity', 1);

  // 悬停交互：散点放大 + Tooltip
  circles
    .on('mouseover', function (event, d) {
      d3.select(this).attr('r', 6).attr('fill', '#ff7f0e');
      tooltip
        .html(`HbA1c: ${d.hbA1c.toFixed(1)}%<br>Risk: ${(d.risk_prob * 100).toFixed(1)}%`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 30) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function () {
      d3.select(this).attr('r', 4).attr('fill', '#d62728');
      tooltip.style('opacity', 0);
    });
}



/* =========================================================================
   4. 血糖浓度分布 —— 小提琴 + 箱线图组合
   如果不需要这部分，可直接注释掉 drawViolinBoxPlot(rawData) 的调用，
   或者将整个函数体删除 / 注释掉。
   ========================================================================= */
function drawViolinBoxPlot(data) {
  const ageGroups = Array.from(new Set(data.map(d => d.ageDecade))).sort((a, b) => {
    const a0 = +a.split('–')[0], b0 = +b.split('–')[0];
    return a0 - b0;
  });
  const hbaStates = ['normal', 'prediabetes', 'diabetes'];

  const margin = { top: 20, right: 80, bottom: 60, left: 60 };
  const width = 900 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = d3.select('#violinBoxPlot')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand()
    .domain(ageGroups)
    .range([0, width])
    .paddingInner(0.2);

  const x1 = d3.scaleBand()
    .domain(hbaStates)
    .range([0, x0.bandwidth()])
    .padding(0.1);

  const bloodMin = d3.min(data, d => d.blood_glucose);
  const bloodMax = d3.max(data, d => d.blood_glucose);
  const y = d3.scaleLinear()
    .domain([bloodMin - 5, bloodMax + 5])
    .nice()
    .range([height, 0]);

  // 绘制坐标轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .selectAll('text')
    .attr('transform', 'rotate(0)')
    .style('text-anchor', 'middle');

  svg.append('g')
    .call(d3.axisLeft(y));

  // 轴标签
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 10)
    .attr('text-anchor', 'middle')
    .text('Age Decade');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .text('Blood Glucose Level (mg/dL)');

  // KDE 函数
  function kernelDensityEstimator(kernel, X) {
    return function (V) {
      return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
    };
  }
  function kernelEpanechnikov(k) {
    return function (v) {
      v /= k;
      return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
  }

  const xTicks = d3.range(bloodMin, bloodMax + 1, 1);

  const allGroups = [];
  ageGroups.forEach(ad => {
    hbaStates.forEach(st => {
      const arr = data
        .filter(d => d.ageDecade === ad && d.hba1cStatus === st)
        .map(d => d.blood_glucose);

      if (arr.length === 0) {
        allGroups.push({ ageDecade: ad, status: st, density: [], box: null });
        return;
      }

      const kde = kernelDensityEstimator(kernelEpanechnikov(5), xTicks);
      const density = kde(arr);

      const sorted = arr.sort(d3.ascending);
      const q1 = d3.quantile(sorted, 0.25);
      const median = d3.quantile(sorted, 0.5);
      const q3 = d3.quantile(sorted, 0.75);
      const iqr = q3 - q1;
      const lowerWhisker = d3.max([d3.min(sorted), q1 - 1.5 * iqr]);
      const upperWhisker = d3.min([d3.max(sorted), q3 + 1.5 * iqr]);

      allGroups.push({
        ageDecade: ad,
        status: st,
        density: density,
        box: { q1, median, q3, lowerWhisker, upperWhisker }
      });
    });
  });

  const maxDensity = d3.max(allGroups, g =>
    g.density.length ? d3.max(g.density, d => d[1]) : 0
  );

  const xViolin = d3.scaleLinear()
    .domain([0, maxDensity])
    .range([0, x1.bandwidth() / 2]);

  const groupContainer = svg.append('g')
    .selectAll('g')
    .data(allGroups)
    .enter()
    .append('g')
      .attr('transform', d => `
        translate(
          ${x0(d.ageDecade) + x1(d.status) + x1.bandwidth() / 2},
          0
        )
      `)
      .attr('opacity', 0);

  // 绘制小提琴
  groupContainer.each(function (d) {
    const grp = d3.select(this);
    if (!d.density.length) return;

    grp.append('path')
      .datum(d.density)
      .attr('d', d3.area()
        .x0(pt => xViolin(pt[1]))
        .x1(pt => 0)
        .y(pt => y(pt[0]))
        .curve(d3.curveCatmullRom))
      .attr('fill', '#69b3a2')
      .attr('stroke', '#2a7f65')
      .attr('stroke-width', 1)
      .attr('opacity', 0.6);

    grp.append('path')
      .datum(d.density)
      .attr('d', d3.area()
        .x0(pt => -xViolin(pt[1]))
        .x1(pt => 0)
        .y(pt => y(pt[0]))
        .curve(d3.curveCatmullRom))
      .attr('fill', '#69b3a2')
      .attr('stroke', '#2a7f65')
      .attr('stroke-width', 1)
      .attr('opacity', 0.6);
  });

  // 绘制箱线（如果需要，可保留；若不想要，可以删除以下几行）
  groupContainer.each(function (d) {
    const grp = d3.select(this);
    if (!d.box) return;

    const { q1, median, q3, lowerWhisker, upperWhisker } = d.box;
    const boxW = x1.bandwidth() * 0.5;

    grp.append('rect')
      .attr('x', -boxW / 2)
      .attr('y', y(q3))
      .attr('width', boxW)
      .attr('height', y(q1) - y(q3))
      .attr('stroke', '#264653')
      .attr('fill', '#69b3a2')
      .attr('opacity', 0.8);

    grp.append('line')
      .attr('x1', -boxW / 2)
      .attr('x2', boxW / 2)
      .attr('y1', y(median))
      .attr('y2', y(median))
      .attr('stroke', '#264653')
      .attr('stroke-width', 2);

    grp.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', y(upperWhisker))
      .attr('y2', y(q3))
      .attr('stroke', '#264653')
      .attr('stroke-width', 1);
    grp.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', y(q1))
      .attr('y2', y(lowerWhisker))
      .attr('stroke', '#264653')
      .attr('stroke-width', 1);

    grp.append('line')
      .attr('x1', -boxW / 4)
      .attr('x2', boxW / 4)
      .attr('y1', y(upperWhisker))
      .attr('y2', y(upperWhisker))
      .attr('stroke', '#264653')
      .attr('stroke-width', 1);
    grp.append('line')
      .attr('x1', -boxW / 4)
      .attr('x2', boxW / 4)
      .attr('y1', y(lowerWhisker))
      .attr('y2', y(lowerWhisker))
      .attr('stroke', '#264653')
      .attr('stroke-width', 1);
  });

  groupContainer.transition()
    .delay((d, i) => i * 200)
    .duration(800)
    .attr('opacity', 1);

  // 如果不需要图例，也可以删除以下几行
  const legend = svg.append('g')
    .attr('transform', `translate(${width + 20}, 20)`);

  legend.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 12).attr('height', 12)
    .attr('fill', '#69b3a2')
    .attr('opacity', 0.6);
  legend.append('text')
    .attr('x', 18).attr('y', 12)
    .text('Violin + Box')
    .attr('font-size', '12px')
    .attr('alignment-baseline', 'middle');
}

// 确保放在 main.js 最末尾，或放到 index.html 中 </body> 前
document.addEventListener('DOMContentLoaded', function() {
  // 找到所有 .carousel .slide
  const slides = document.querySelectorAll('.carousel .slide');
  let currentIndex = 0;
  const slideCount = slides.length;
  const intervalTime = 3000; // 每隔 3000ms（3 秒）切换一张

  // 如果根本没有 slide，或只有一张，不用轮播
  if (slideCount <= 1) return;

  function showNextSlide() {
    // 去掉当前这一张的 active
    slides[currentIndex].classList.remove('active');
    // 计算下一张索引
    currentIndex = (currentIndex + 1) % slideCount;
    // 给下一张加上 active
    slides[currentIndex].classList.add('active');
  }

  // 先预留 t=3s 后开始第一次切换
  setInterval(showNextSlide, intervalTime);
});