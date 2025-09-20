<template>
  <div v-if="visible" class="tree-node" :style="{ marginLeft: (level * 12) + 'px' }">
    <template v-if="isObject || isArray">
      <span class="toggle" @click="toggle">{{ expanded ? '▼' : '▶' }}</span>
      <span class="node-type">{{ isArray ? 'Array' : 'Object' }}</span>
      <div v-show="expanded">
        <div v-for="(item, idx) in entries" :key="((item.k !== undefined && item.k !== null) ? item.k : idx) + '-' + idx">
          <TreeNode
            :data="item.v"
            :level="level + 1"
            :filter="filter"
            :path="currentPath + '.' + item.k"
            :expanded-keys="expandedKeys"
            @toggle="$emit('toggle', $event)"
          />
        </div>
      </div>
    </template>
    <template v-else>
      <span class="leaf">{{ displayValue }}</span>
    </template>
  </div>
</template>

<script>
export default {
  name: 'TreeNode',
  props: {
    data: { type: [Object, Array, String, Number, Boolean, null], required: false },
    level: { type: Number, default: 0 },
    filter: { type: String, default: '' },
    path: { type: String, default: '' },
    expandedKeys: { type: Object, default: null }
  },
  emits: ['toggle'],
  computed: {
    isObject() { return this.data && typeof this.data === 'object' && !Array.isArray(this.data) },
    isArray() { return Array.isArray(this.data) },
    entries() {
      if (!this.isObject && !this.isArray) return []
      const obj = this.data
      const out = []
      if (this.isArray) {
        obj.forEach((v, i) => out.push({ k: String(i), v }))
      } else {
        Object.keys(obj).forEach(k => out.push({ k, v: obj[k] }))
      }
      return out
    },
    currentPath() { return this.path || '$root' },
    visible() {
      if (!this.filter) return true
      try {
        const txt = JSON.stringify(this.data)
        return txt && txt.toLowerCase().includes(this.filter.toLowerCase())
      } catch (e) {
        return true
      }
    },
    expanded() { return this.expandedKeys && this.expandedKeys.has && this.expandedKeys.has(this.currentPath) },
    displayValue() {
      if (typeof this.data === 'string') return this.data
      try { return JSON.stringify(this.data) } catch (e) { return String(this.data) }
    }
  },
  methods: {
    toggle() { this.$emit('toggle', this.currentPath) }
  }
}
</script>

<style scoped>
.tree-node { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; }
.tree-node .toggle { cursor: pointer; margin-right: 6px; color: #555; }
.tree-node .node-type { color: #888; margin-right: 6px; }
.tree-node .leaf { color: #222; }
</style>
