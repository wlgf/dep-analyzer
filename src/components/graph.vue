<style scoped>
  .graph-box {
    width: 1200px;
    height: 600px;
    margin: 0 auto;
    border-radius: 20px;
    background-color: #eee;
  }
</style>
<template>
  <div class="graph-box">
    <svg id="graph" width="1200" height="600"></svg>
  </div>
</template>
 
<script>
import * as d3 from 'd3';
 
export default {
  name: "graph",
  data() {
    return {
      nodes: [
        {id: 1, name: 'vue', version: '1.02'},
        {id: 2, name: 'npm', version: '2.12'},
        {id: 3, name: 'axios', version: '4.12'},
        {id: 4, name: 'd3 ', version: '1.01'},
        {id: 5, name: 'router',version: '3.11'}
      ],
      links: [
        {source: 1, target: 2},
        {source: 1, target: 3},
        {source: 1, target: 4},
        {source: 2, target: 1},
        {source: 3, target: 2},
        {source: 3, target: 5},
      ]
    }
  },
  mounted() {
    const svg = d3.select('#graph');
    const width = svg.attr('width');
    const height = svg.attr('height');

    // 首先计算每个节点的连接线数量
    const nodeConnections = {};
    this.links.forEach(link => {
      const sourceId = link.source;
      const targetId = link.target;

      // 统计每个节点的连接线数量
      nodeConnections[sourceId] = nodeConnections[sourceId] ? nodeConnections[sourceId] + 1 : 1;
      nodeConnections[targetId] = nodeConnections[targetId] ? nodeConnections[targetId] + 1 : 1;
    });
 
    // 设置力导图
    const simulation = d3.forceSimulation(this.nodes)
        .force('link', d3.forceLink(this.links).id(d => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-100)) // 负数为斥力，正数为引力
        .force('center', d3.forceCenter(width / 2, height / 2));

    // 设置连接线
    const link = svg.selectAll('line')
        .data(this.links)
        .enter()
        .append('line')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1);

    // 设置圆点
    // const node = svg.selectAll('circle')
    //     .data(this.nodes)
    //     .enter()
    //     .append('circle')
    //     .attr('r', 10)
    //     .attr('fill', 'red')
    //     .call(d3.drag()
    //         .on('start', dragstarted)
    //         .on('drag', dragged)
    //         .on('end', dragended));

    // 设置矩形
    const node = svg.selectAll('rect')
        .data(this.nodes)
        .enter()
        .append('rect')
        .attr('width', 80)
        .attr('height', 50)
        .attr('rx', '20') // 圆角矩形弧度
        .attr('ry', '20')
        .attr('transform', `translate(-40, -20)`) // 移动到中心
        .attr('fill', d => {
          const connections = nodeConnections[d.id];
          // 根据连接线数量映射节点的颜色深浅
          const color = getColorBasedOnConnections(connections);
          return color;
        })
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // 设置标签
    const label = svg.selectAll('.label-text')
        .data(this.nodes)
        .enter()
        .append('text')
        .text(function (d) {return d.name;})
        .attr("dy", '0.2rem')
        .attr('text-anchor', 'middle')  // 水平居中
        .style("fill", '#fff')
        .style('font-size', "1rem")
    
    // 设置版本标签
    const version = svg.selectAll('.version-text')
        .data(this.nodes)
        .enter()
        .append('text')
        .text(function(d) { return d.version; })
        .attr("dy", '1.3rem') // 将 dy 值调整为更下方显示
        .attr('text-anchor', 'middle')
        .style("fill", '#fff')
        .style('font-size', "0.8rem") // 可以根据需要调整字体大小
        .attr('x', function(d) { return d.x; })
        .attr('y', function(d) { return d.y; });
    
    // 在 SVG 容器中绘制颜色条
    var defs = svg.append("defs");

    // 创建一个线性比例尺，定义颜色范围
    var colorScale = d3.scaleLinear()
        .domain([0, 100]) // 设定数据的取值范围
        .range(["blue", "red"]); // 设定对应的颜色范围

    var linearGradient = defs.append("linearGradient")
        .attr("id", "color-gradient") // 定义线性渐变的 ID
        .attr("x1", "0%")
        .attr("y1", "100%") // 将 y1 设置为 100%
        .attr("x2", "0%")
        .attr("y2", "0%"); // 将 y2 设置为 0%
    
    linearGradient.selectAll("stop")
        .data(d3.range(0, 1.1, 0.1)) // 根据比例划分渐变色块
        .enter().append("stop")
        .attr("offset", function(d) { return d * 100 + "%"; })
        .attr("stop-color", function(d) { return colorScale(d * 100); });
 
    // 在 SVG 中选择一个矩形元素作为颜色条
    var colorBar = svg.append("rect")
        .attr("x", 1100)
        .attr("y", 200)
        .attr("width", 20)
        .attr("height", 200)
        .style("fill", "url(#color-gradient)");
 
    simulation.on('tick', () => {
      link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
 
      node
          .attr('x', d => d.x)
          .attr('y', d => d.y);
      label
          .attr('x', function (d) {return d.x;})
          .attr('y', function (d) {return d.y;});
      version
          .attr('x', function (d) {return d.x;})
          .attr('y', function (d) {return d.y;});          
    });
 
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.1).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
 
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
 
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // 渐变色设置
    function getColorBasedOnConnections(connections) {
      // 定义起始和结束的 RGB 值
      const startRGB = [0, 0, 255];
      const endRGB = [255, 0, 0];

      // 定于最大连接数量
      const maxConnections = 5;

      // 计算颜色深度百分比（基于连接线数量）
      const percentage = connections / maxConnections;

      // 将颜色值映射渐变
      const rgb = startRGB.map((startVal, index) => {
        const endVal = endRGB[index];
        const colorVal = Math.round(startVal + percentage * (endVal - startVal));
        return colorVal;
      });

      // 返回颜色的字符串表示（例如："rgb(128, 0, 127)"）
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  }
}
</script>