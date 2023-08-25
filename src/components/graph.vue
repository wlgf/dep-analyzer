<style scoped>
  main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .graph-box {
    width: 1200px;
    height: 600px;
    margin: 0 auto;
    border-radius: 20px;
    background-color: #eee;
  }
</style>
<template>
  <main>
    <div class="graph-box">
      <svg id="graph" width="1200" height="600"></svg>
    </div>
    <form>
      <label>节点最大连接数量：</label><input type="text" v-model="maxNodeConnect" @change="render">
      <label>箭头颜色：</label><input type="text" v-model="markerColor" @change="render">
      <label>连接线颜色：</label><input type="text" v-model="lineColor" @change="render">
    </form>
  </main>
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
        // {source: 3, target: 5}
      ],
      // 箭头颜色
      markerColor: 'black',
      // 连接线颜色
      lineColor: 'black',
      // 节点最大连接数量
      maxNodeConnect: 6,
      // 0连接节点颜色rgb
      startRGB: [0, 0, 255],
      // 最大连接节点颜色rgb
      endRGB: [255, 0, 0],
    }
  },
  mounted() {
    this.render()
  },
  methods: {
    render() {
      const svg = d3.select('#graph');
      svg.selectAll('*').remove();
      const width = svg.attr('width');
      const height = svg.attr('height');

      // 首先计算每个节点的连接线数量
      const nodeConnections = {};
      this.nodes.forEach(node => {nodeConnections[node.id] = 0})
      this.links.forEach(link => {
        const sourceId = link.source.id?link.source.id:link.source;
        const targetId = link.target.id?link.target.id:link.target;

        // 统计每个节点的连接线数量
        nodeConnections[sourceId] = nodeConnections[sourceId] ? nodeConnections[sourceId] + 1 : 1;
        nodeConnections[targetId] = nodeConnections[targetId] ? nodeConnections[targetId] + 1 : 1;
      });
  
      // 设置力导图
      const simulation = d3.forceSimulation(this.nodes)
          .force("x", d3.forceX(width))
          .force("y", d3.forceY(height))
          .force('link', d3.forceLink(this.links).id(d => d.id).distance(150))
          .force('charge', d3.forceManyBody().strength(-1150)) // 负数为斥力，正数为引力
          .force('center', d3.forceCenter(width / 2, height / 2))
          

      // 设置连接标头
      svg.append("defs").selectAll("marker")
        .data(["icon"])
        .join("marker")
        .attr("id", d => `arrow-${d}`)
        .attr("viewBox", "0 -5 15 5")
        .attr("refX", 25)
        .attr("refY", -0.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("fill", this.markerColor)
        .attr("d", "M0,-5L15,0L0,5")

      // 设置无向连接线
      // const link = svg.selectAll('line')
      //     .data(this.links)
      //     .enter()
      //     .append('line')
      //     .attr('stroke', '#ccc')
      //     .attr('stroke-width', 1);

      // 设置有向连接线
      const link = svg.append("g") // 添加一个分组group
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(this.links)
        .join("path")
        .attr("stroke", this.lineColor)
        .attr("marker-end", d => `url(${new URL(`#arrow-icon`, location)})`);

      // 设置圆点
      const node = svg.selectAll('circle')
          .data(this.nodes)
          .enter()
          .append('circle')
          .attr("stroke", "white")
          .attr("stroke-width", 1.5)
          .attr('r', 4)
          .attr('fill', d => {
            const connections = nodeConnections[d.id];
            // 根据连接线数量映射节点的颜色深浅
            const color = getColorBasedOnConnections(connections, this.startRGB, this.endRGB, this.maxNodeConnect);
            return color;
          })
          .call(d3.drag()
              .on('start', dragstarted)
              .on('drag', dragged)
              .on('end', dragended));

      // 设置矩形
      const nodeRect = svg.selectAll('rect')
          .data(this.nodes)
          .enter()
          .append('rect')
          .attr('width', 80)
          .attr('height', 50)
          .attr('rx', '20') // 圆角矩形弧度
          .attr('ry', '20')
          .attr('transform', `translate(-80, -50)`) // 移动到中心
          .attr('fill', d => {
            const connections = nodeConnections[d.id];
            // 根据连接线数量映射节点的颜色深浅
            const color = getColorBasedOnConnections(connections, this.startRGB, this.endRGB, this.maxNodeConnect);
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
          .attr('transform', `translate(-40, -30)`) // 移动到中心
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
          .attr('transform', `translate(-40, -30)`) // 移动到中心
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
          .range([`rgb(${this.startRGB.join(",")})`, `rgb(${this.endRGB.join(",")})`]); // 设定对应的颜色范围

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
  
      // 绘制刻度条
      svg
        .append("rect")
        .attr("x", 1100)
        .attr("y", 100)
        .attr("width", 20)
        .attr("height", 400)
        .style("fill", "url(#color-gradient)");
      
      // 绘制表头
      svg.append("text")
      .attr("x", 1070)
      .attr("y", 80)
      .attr("fill", 'black')
      .attr('font-size', "14px")
      .attr('font-weight', "bold")
      .text('连接数颜色值')

      // 绘制刻度文本
      svg
        .selectAll(".scale-text")
        .data(d3.range(Number(this.maxNodeConnect)+1).map(item => `-${item}`).reverse())
        .enter()
        .append("text")
        .style("fill", '#666')
        .style('font-size', "12px")
        .attr("x", 1120)
        .attr("y", (d, i) => 104 + i * (400 / this.maxNodeConnect))
        .text((d) => d);
    

      function linkArc(d) {
        const r = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
        return `
          M${d.source.x},${d.source.y}
          A${r},${r} 0 0,1 ${d.target.x},${d.target.y}
        `;
      }
  
      simulation.on('tick', () => {
        // link
        //     .attr('x1', d => d.source.x)
        //     .attr('y1', d => d.source.y)
        //     .attr('x2', d => d.target.x)
        //     .attr('y2', d => d.target.y);

        link.attr("d", linkArc);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
  
        nodeRect
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
      function getColorBasedOnConnections(connections, startRGB, endRGB, maxConnections) {
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
}
</script>