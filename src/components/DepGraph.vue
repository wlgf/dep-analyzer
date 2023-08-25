<template>
  <main>
    <div class="graph-box">
      <svg id="graph" width="1200" height="600"></svg>
    </div>
  </main>
</template>

<script>
import * as d3 from 'd3'
import axios from 'axios'

export default {
  name: 'DepGraph',
  data() {
    return {
      nodes: [],
      edges: [],
      maxDegree: 6, // 节点最大连接数量
      minColor: [82, 196, 26], // 0连接节点颜色
      maxColor: [22, 119, 255], // 最大连接节点颜色
    }
  },
  async mounted() {
    const data = await axios.get('/dep-analyze.json')
    this.nodes = data.data.nodes
    this.edges = data.data.edges

    // 计算每个节点的度与最大的度.
    for (let i in this.nodes) this.nodes[i].degree = 0
    for (const { source, target } of this.edges) {
      this.nodes[source].degree += 1
      this.nodes[target].degree += 1
    }
    this.maxDegree = Math.max(...this.nodes.map(v => v.degree))

    this.render()
  },
  methods: {
    render() {
      const svg = d3.select('#graph').style('font', '12px sans-serif')

      svg.selectAll('*').remove()

      const width = svg.attr('width')
      const height = svg.attr('height')

      const simulation = d3
        .forceSimulation(this.nodes)
        .force('x', d3.forceX(width))
        .force('y', d3.forceY(height))
        .force(
          'link',
          d3.forceLink(this.edges).id(d => d.id)
        )
        .force('charge', d3.forceManyBody(-100))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .on('tick', ticked)

      // 绘制箭头形状.
      svg
        .append('defs')
        .append('marker')
        .attr('id', 'arrow-icon')
        .attr('viewBox', '0 -5 15 5')
        .attr('refX', 25)
        .attr('refY', -0.5)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', '#ccc')
        .attr('d', 'M 0 -5 L 15 0 L 0 5')

      // 绘制边.
      const edge = svg
        .selectAll('path')
        .data(this.edges)
        .enter()
        .append('path')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1)
        .attr('marker-end', 'url(#arrow-icon)')

      // 绘制节点及文字.
      const node = svg
        .append('g')
        .attr('fill', 'currentColor')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .selectAll('g')
        .data(this.nodes)
        .join('g')
        .call(this.drag(simulation))
        .on('mouseover', overed)
        .on('mouseout', outed)

      node
        .append('circle')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .attr('r', 4)
        .attr('fill', d => this.getColorByDegree(d.degree))

      node
        .append('text')
        .attr('x', 8)
        .attr('y', '0.31em')
        .text(d => `${d.name}@${d.version}`)
        .style('display', 'none')
        .each(function (d) {
          d.text = this
        })

      // 绘制颜色条.
      const defs = svg.append('defs')

      // 创建线性比例尺.
      const colorScale = d3
        .scaleLinear()
        .domain([0, 100])
        .range([
          `rgb(${this.minColor.join(',')})`,
          `rgb(${this.maxColor.join(',')})`,
        ])

      const linearGradient = defs
        .append('linearGradient')
        .attr('id', 'color-gradient')
        .attr('x1', '0%')
        .attr('y1', '100%')
        .attr('x2', '0%')
        .attr('y2', '0%')

      linearGradient
        .selectAll('stop')
        .data(d3.range(0, 1.1, 0.1))
        .enter()
        .append('stop')
        .attr('offset', d => `${100 * d}%`)
        .attr('stop-color', function (d) {
          return colorScale(d * 100)
        })

      // 绘制刻度条.
      svg
        .append('rect')
        .attr('x', 1100)
        .attr('y', 100)
        .attr('width', 20)
        .attr('height', 400)
        .style('fill', 'url(#color-gradient)')

      // 绘制表头.
      svg
        .append('text')
        .attr('x', 1070)
        .attr('y', 80)
        .attr('fill', 'black')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .text('连接数颜色值')

      // 绘制刻度文本.
      const range = d3
        .range(
          1,
          this.maxDegree + 1,
          this.maxDegree > 10 ? Math.round(this.maxDegree / 10) : 1
        )
        .reverse()

      svg
        .selectAll('.scale-text')
        .data(range)
        .enter()
        .append('text')
        .style('fill', '#666')
        .style('font-size', '12px')
        .attr('x', 1120)
        .attr('y', d => 503 - 400 * ((d - 1) / (this.maxDegree - 1)))
        .text(d => `- ${d}`)

      function ticked() {
        const getLine = d =>
          `M ${d.source.x} ${d.source.y} L ${d.target.x} ${d.target.y}`
        edge.attr('d', getLine)
        node.attr('transform', d => `translate(${d.x}, ${d.y})`)
      }

      function overed(event, d) {
        d3.select(d.text).style('display', 'unset')
      }

      function outed(event, d) {
        d3.select(d.text).style('display', 'none')
      }
    },
    drag(simulation) {
      const dragstarted = (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      }

      const dragged = (event, d) => {
        d.fx = event.x
        d.fy = event.y
      }

      const dragended = (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      }

      return d3
        .drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
    },
    /**
     * 根据节点的度计算其填充色.
     * @param {*} degree 节点的度.
     * @returns {string} 节点填充色的 CSS rgb 函数格式.
     */
    getColorByDegree(degree) {
      const percentage = degree / this.maxDegree

      let color = []
      for (let i = 0; i < 3; i++) {
        const min = this.minColor[i]
        const max = this.maxColor[i]
        color.push(Math.round(min + percentage * (max - min)))
      }

      return `rgb(${color.join(',')})`
    },
  },
}
</script>

<style scoped>
* {
  user-select: none;
}

main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.graph-box {
  max-width: 100%;
  max-height: 100%;
  width: 1200px;
  height: 600px;
  margin: 0 auto;
  border-radius: 20px;
  background-color: #eee;
}
</style>
