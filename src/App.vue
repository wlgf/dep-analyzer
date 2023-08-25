<template>
  <div id="app">
    <dep-graph />
  </div>
</template>

<script>
import DepGraph from './components/DepGraph.vue'

export default {
  name: 'App',
  components: {
    DepGraph,
  },
}
</script>
