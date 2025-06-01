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
    drawClusterPlot(rawData);
    // 如果需要箱线＋小提琴图组合，可取消注释
    // drawViolinBoxPlot(rawData);
  }).catch(error => {
    console.error('加载 diabetes_prediction_dataset.csv 出错：', error);
  });
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

  const dataAll = data;
  const dataNormal = data.filter(d => d.status === 'normal');
  const dataPre = data.filter(d => d.status === 'prediabetes');
  const dataDia = data.filter(d => d.status === 'diabetes');

  const xDomain = [
    d3.min(dataAll, d => d.hbA1c) - 0.5,
    d3.max(dataAll, d => d.hbA1c) + 0.5
  ];
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([0, width]);

  const histogramGen = d3.histogram()
    .value(d => d.hbA1c)
    .domain(x.domain())
    .thresholds(x.ticks(30));

  const binsAll = histogramGen(dataAll);
  const binsNor = histogramGen(dataNormal);
  const binsPre = histogramGen(dataPre);
  const binsDia = histogramGen(dataDia);

  let currentBins = binsAll;

  const y = d3.scaleLinear()
    .domain([0, d3.max(binsAll, d => d.length)])
    .range([height, 0]);

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  const yAxis = svg.append('g')
    .call(d3.axisLeft(y));

  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  const rects = svg.selectAll('rect')
    .data(currentBins)
    .enter()
    .append('rect')
      .attr('x', d => x(d.x0) + 1)
      .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', '#69b3a2');

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

  rects.transition()
    .duration(1200)
    .attr('y', d => y(d.length))
    .attr('height', d => height - y(d.length));

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
   2. HbA1c 随年龄变化趋势 —— 带动画折线 + 自动滑块
   ========================================================================= */
function drawAgeTrend(data) {
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

  const x = d3.scaleLinear()
    .domain(d3.extent(ageTrend, d => d.age))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(ageTrend, d => d.mean - d.std) - 0.2,
      d3.max(ageTrend, d => d.mean + d.std) + 0.2
    ])
    .range([height, 0]);

  const line = d3.line()
    .x(d => x(d.age))
    .y(d => y(d.mean))
    .curve(d3.curveMonotoneX);

  const area = d3.area()
    .x(d => x(d.age))
    .y0(d => y(d.mean - d.std))
    .y1(d => y(d.mean + d.std))
    .curve(d3.curveMonotoneX);

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

  const areaPath = svg.append('path')
    .datum(ageTrend)
    .attr('fill', '#ff7f0e')
    .attr('opacity', 0)
    .attr('d', area);

  areaPath
    .transition().delay(800).duration(800)
    .attr('opacity', 0.2);

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(7));
  svg.append('g')
    .call(d3.axisLeft(y));

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

  updateAge(d3.min(ages));
  startAutoPlay();
}



/* =========================================================================
   3. HbA1c vs. Diabetes Risk Curve —— 动态散点 + 描边曲线 + 网格线淡入 + Tooltip
   ========================================================================= */
function drawRiskCurve(data) {
  data.forEach(d => {
    d.hbA1cRound = Math.round(d.hbA1c * 10) / 10;
  });

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

  const x = d3.scaleLinear()
    .domain(d3.extent(riskData, d => d.hbA1c))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0]);

  const yGrid = d3.axisLeft(y)
    .tickSize(-width)
    .tickFormat('')
    .ticks(5);

  const gridGroup = svg.append('g')
    .attr('class', 'grid-line')
    .attr('opacity', 0)
    .call(yGrid);

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  svg.append('g')
    .call(d3.axisLeft(y).ticks(5));

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

  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

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

  riskPath.transition()
    .delay(riskData.length * 30 + 200)
    .duration(1200)
    .attr('stroke-dashoffset', 0);

  gridGroup.transition()
    .delay(riskData.length * 30 + 800)
    .duration(800)
    .attr('opacity', 1);

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
   4. K-Means 聚类 & 轮播高亮显示函数
   在 #clusterPlot 中绘制横轴 HbA1c、纵轴 blood_glucose 的散点聚类图。
   簇数 k=3，依次高亮“低风险→中风险→高风险”人群。
   ========================================================================= */
function kmeans2D(data, k, maxIter = 30) {
  const centroids = [];
  const used = new Set();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * data.length);
    if (!used.has(idx)) {
      used.add(idx);
      centroids.push({ x: data[idx].hbA1c, y: data[idx].blood_glucose });
    }
  }

  let assignments = new Array(data.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < data.length; i++) {
      const dx = data[i].hbA1c, dy = data[i].blood_glucose;
      let bestC = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const cx = centroids[c].x, cy = centroids[c].y;
        const dist = (dx - cx) ** 2 + (dy - cy) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestC = c;
        }
      }
      if (assignments[i] !== bestC) {
        changed = true;
        assignments[i] = bestC;
      }
    }
    const sums = new Array(k).fill(0).map(() => ({ x: 0, y: 0, count: 0 }));
    for (let i = 0; i < data.length; i++) {
      const c = assignments[i];
      sums[c].x += data[i].hbA1c;
      sums[c].y += data[i].blood_glucose;
      sums[c].count += 1;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c].count > 0) {
        centroids[c].x = sums[c].x / sums[c].count;
        centroids[c].y = sums[c].y / sums[c].count;
      }
    }
    if (!changed) break;
  }

  return { centroids, assignments };
}

function drawClusterPlot(rawData) {
  // 过滤 NaN
  const filtered = rawData.filter(d =>
    !isNaN(d.hbA1c) && !isNaN(d.blood_glucose)
  );

  // 执行 k-means, k=3
  const { centroids, assignments } = kmeans2D(filtered, 3, 30);
  filtered.forEach((d, i) => d.cluster = assignments[i]);

  // 按 centroid.x 排序，映射到风险标签
  const centroidOrder = centroids
    .map((c, idx) => ({ idx, hbA1c: c.x }))
    .sort((a, b) => a.hbA1c - b.hbA1c)
    .map(d => d.idx);

  const riskLabels = ['低风险', '中风险', '高风险'];
  const clusterToRisk = {};
  centroidOrder.forEach((clusterIdx, i) => {
    clusterToRisk[clusterIdx] = riskLabels[i];
  });

  // 画布
  const margin = { top: 20, right: 40, bottom: 50, left: 60 };
  const width = 700 - margin.left - margin.right;
  const height = 450 - margin.top - margin.bottom;

  const svg = d3.select('#clusterPlot')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // x 轴：hbA1c
  const xMin = d3.min(filtered, d => d.hbA1c);
  const xMax = d3.max(filtered, d => d.hbA1c);
  const x = d3.scaleLinear()
    .domain([xMin - 0.5, xMax + 0.5])
    .range([0, width]);

  // y 轴：blood_glucose
  const yMin = d3.min(filtered, d => d.blood_glucose);
  const yMax = d3.max(filtered, d => d.blood_glucose);
  const y = d3.scaleLinear()
    .domain([yMin - 5, yMax + 5])
    .range([height, 0]);

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));
  svg.append('g')
    .call(d3.axisLeft(y));

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 10)
    .attr('text-anchor', 'middle')
    .text('HbA1c (%)');
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .text('Blood Glucose (mg/dL)');

  const clusterColors = ['#2a9d8f', '#e76f51', '#9d0208'];
  const defaultColor = '#cccccc';
  const radius = 4;
  const highlightRadius = 6;

  const dots = svg.selectAll('.dot')
    .data(filtered)
    .enter()
    .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.hbA1c))
      .attr('cy', d => y(d.blood_glucose))
      .attr('r', radius)
      .attr('fill', defaultColor)
      .attr('opacity', 0.5);

  // 绘制质心
  svg.selectAll('.centroid')
    .data(centroids)
    .enter()
    .append('circle')
      .attr('class', 'centroid')
      .attr('cx', d => x(d.x))
      .attr('cy', d => y(d.y))
      .attr('r', 8)
      .attr('fill', (d,i) => clusterColors[ centroidOrder.indexOf(i) ])
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8);

  // 图例
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 120}, 10)`);

  riskLabels.forEach((label, i) => {
    const yOff = i * 20;
    legend.append('rect')
      .attr('x', 0)
      .attr('y', yOff)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', clusterColors[i]);
    legend.append('text')
      .attr('x', 18)
      .attr('y', yOff + 10)
      .text(label)
      .attr('font-size', '12px')
      .attr('alignment-baseline', 'middle');
  });

  let currentHighlight = 0;
  function highlightCluster(clusterIdx) {
    dots.transition()
      .duration(300)
      .attr('fill', d => {
        return (clusterToRisk[d.cluster] === riskLabels[clusterIdx])
          ? clusterColors[clusterIdx]
          : defaultColor;
      })
      .attr('r', d => {
        return (clusterToRisk[d.cluster] === riskLabels[clusterIdx])
          ? highlightRadius
          : radius;
      })
      .attr('opacity', d => {
        return (clusterToRisk[d.cluster] === riskLabels[clusterIdx])
          ? 0.9
          : 0.1;
      });
  }

  highlightCluster(0);
  d3.interval(() => {
    currentHighlight = (currentHighlight + 1) % 3;
    highlightCluster(currentHighlight);
  }, 2000);
}



/* =========================================================================
   5. 血糖浓度分布 —— 小提琴 + 箱线图组合
   如果不需要，可以删除或注释掉 drawViolinBoxPlot 的调用
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

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .selectAll('text')
    .attr('transform', 'rotate(0)')
    .style('text-anchor', 'middle');

  svg.append('g')
    .call(d3.axisLeft(y));

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
