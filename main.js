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
    // 为每条记录添加 status（HbA1c 状态）和 ageGroup
    rawData.forEach(d => {
      // HbA1c 状态（可选，仅作后续风险曲线使用）
      if (d.hbA1c < 5.7) d.status = 'normal';
      else if (d.hbA1c < 6.5) d.status = 'prediabetes';
      else d.status = 'diabetes';

      // 年龄分组：0-20, 20-40, 40-60, 60-80
      if (d.age <= 20) {
        d.ageGroup = '0–20';
      } else if (d.age > 20 && d.age <= 40) {
        d.ageGroup = '20–40';
      } else if (d.age > 40 && d.age <= 60) {
        d.ageGroup = '40–60';
      } else if (d.age > 60 && d.age <= 80) {
        d.ageGroup = '60–80';
      } else {
        d.ageGroup = 'Other';  // 若有超出 80 岁的数据，可放这里
      }
    });

    // 执行各个可视化函数
    drawHistogram(rawData);
    drawAgeViolinGenderBox(rawData);
    drawRiskCurve(rawData);
  }).catch(error => {
    console.error('加载 diabetes_prediction_dataset.csv 出错：', error);
  });

  // 初始化轮播（Carousel）
  const slides = document.querySelectorAll('.carousel .slide');
  let currentIndex = 0;
  const slideCount = slides.length;
  const intervalTime = 3000; // 每隔 3000ms（3 秒）切换一张
  if (slideCount > 1) {
    setInterval(() => {
      slides[currentIndex].classList.remove('active');
      currentIndex = (currentIndex + 1) % slideCount;
      slides[currentIndex].classList.add('active');
    }, intervalTime);
  }
});

/* =========================================================================
   1. 人群 HbA1c 分布 —— 动态直方图
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
   2. 年龄段 + 性别 分析 —— 小提琴图 & 箱线图
   ========================================================================= */
function drawAgeViolinGenderBox(data) {
  // 过滤出需要的四个年龄组（0-20, 20-40, 40-60, 60-80）
  const ageBins = ['0–20', '20–40', '40–60', '60–80'];
  // 准备每个年龄段的 HbA1c 数组
  const ageGrouped = {};
  ageBins.forEach(bin => ageGrouped[bin] = []);
  data.forEach(d => {
    if (ageGrouped[d.ageGroup] !== undefined) {
      ageGrouped[d.ageGroup].push(d.hbA1c);
    }
  });

  // 性别分组
  const genderBins = ['Male', 'Female'];
  const genderGrouped = { 'Male': [], 'Female': [] };
  data.forEach(d => {
    if (genderGrouped[d.gender] !== undefined) {
      genderGrouped[d.gender].push(d.hbA1c);
    }
  });

  // 1) 绘制小提琴图（Age Violin Plot）
  {
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select('#violinPlot')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // x 轴：年龄组
    const x = d3.scaleBand()
      .domain(ageBins)
      .range([0, width])
      .padding(0.4);

    // y 轴：HbA1c 范围
    const allHbA1c = data.map(d => d.hbA1c);
    const y = d3.scaleLinear()
      .domain([d3.min(allHbA1c) - 0.2, d3.max(allHbA1c) + 0.2])
      .range([height, 0]);

    // 绘制坐标轴
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));
    svg.append('g')
      .call(d3.axisLeft(y));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .text('Age Group');
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .text('HbA1c (%)');

    // Kernel Density Estimator 函数
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

    // 为每个年龄组计算密度
    const xTicks = d3.range(d3.min(allHbA1c), d3.max(allHbA1c) + 0.1, 0.1);
    const allDensities = [];
    ageBins.forEach(bin => {
      const values = ageGrouped[bin];
      if (values.length === 0) {
        allDensities.push({ bin, density: [] });
      } else {
        const kde = kernelDensityEstimator(kernelEpanechnikov(0.4), xTicks);
        const density = kde(values);
        allDensities.push({ bin, density });
      }
    });

    // 找到最大的密度值，用于缩放
    const maxDensity = d3.max(allDensities, d => d3.max(d.density, dd => dd[1]) || 0);

    // 用来绘制小提琴图的水平尺度
    const xNum = d3.scaleLinear()
      .domain([0, maxDensity])
      .range([0, x.bandwidth() / 2]);

    // 绘制每个小提琴
    allDensities.forEach(group => {
      const center = x(group.bin) + x.bandwidth() / 2;
      const grp = svg.append('g');

      // 双边小提琴：先右半部分
      grp.append('path')
        .datum(group.density)
        .attr('d', d3.area()
          .x0(d => center + xNum(d[1]))
          .x1(() => center)
          .y(d => y(d[0]))
          .curve(d3.curveCatmullRom))
        .attr('fill', '#69b3a2')
        .attr('stroke', '#2a7f65')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6);

      // 左半部分
      grp.append('path')
        .datum(group.density)
        .attr('d', d3.area()
          .x0(d => center - xNum(d[1]))
          .x1(() => center)
          .y(d => y(d[0]))
          .curve(d3.curveCatmullRom))
        .attr('fill', '#69b3a2')
        .attr('stroke', '#2a7f65')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6);
    });
  }

  // 2) 绘制性别箱线图（Gender Box Plot），高度与上面相同
  {
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom; // 与小提琴图保持相同高度

    const svg = d3.select('#genderBoxPlot')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // x 轴：Gender
    const x = d3.scaleBand()
      .domain(genderBins)
      .range([0, width])
      .padding(0.4);

    // y 轴：HbA1c 范围，与上面一致
    const allHbA1c = data.map(d => d.hbA1c);
    const y = d3.scaleLinear()
      .domain([d3.min(allHbA1c) - 0.2, d3.max(allHbA1c) + 0.2])
      .range([height, 0]);

    // 绘制轴
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));
    svg.append('g')
      .call(d3.axisLeft(y));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .text('Gender');
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .text('HbA1c (%)');

    // 准备将每个性别组排序并计算箱线图所需的五数概括
    const boxData = [];
    genderBins.forEach(gen => {
      const values = genderGrouped[gen].sort(d3.ascending);
      const q1 = d3.quantile(values, 0.25);
      const median = d3.quantile(values, 0.5);
      const q3 = d3.quantile(values, 0.75);
      const iqr = q3 - q1;
      const lowerWhisker = Math.max(d3.min(values), q1 - 1.5 * iqr);
      const upperWhisker = Math.min(d3.max(values), q3 + 1.5 * iqr);
      boxData.push({ gender: gen, q1, median, q3, lowerWhisker, upperWhisker });
    });

    // 绘制每个箱线
    const boxWidth = x.bandwidth() * 0.5;
    boxData.forEach(d => {
      const cx = x(d.gender) + x.bandwidth() / 2;

      // 箱体
      svg.append('rect')
        .attr('x', cx - boxWidth / 2)
        .attr('y', y(d.q3))
        .attr('width', boxWidth)
        .attr('height', y(d.q1) - y(d.q3))
        .attr('fill', '#ff7f0e')
        .attr('opacity', 0.6)
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);

      // 中位数线
      svg.append('line')
        .attr('x1', cx - boxWidth / 2)
        .attr('x2', cx + boxWidth / 2)
        .attr('y1', y(d.median))
        .attr('y2', y(d.median))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 2);

      // 须线（上下）
      svg.append('line')
        .attr('x1', cx)
        .attr('x2', cx)
        .attr('y1', y(d.upperWhisker))
        .attr('y2', y(d.q3))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);
      svg.append('line')
        .attr('x1', cx)
        .attr('x2', cx)
        .attr('y1', y(d.q1))
        .attr('y2', y(d.lowerWhisker))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);

      // 须端
      svg.append('line')
        .attr('x1', cx - boxWidth / 4)
        .attr('x2', cx + boxWidth / 4)
        .attr('y1', y(d.upperWhisker))
        .attr('y2', y(d.upperWhisker))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);
      svg.append('line')
        .attr('x1', cx - boxWidth / 4)
        .attr('x2', cx + boxWidth / 4)
        .attr('y1', y(d.lowerWhisker))
        .attr('y2', y(d.lowerWhisker))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);
    });
  }
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
    .attr('stroke-dasharray', function () {
      return this.getTotalLength() + ' ' + this.getTotalLength();
    })
    .attr('stroke-dashoffset', function () {
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
