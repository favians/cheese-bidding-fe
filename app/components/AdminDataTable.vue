<script setup lang="ts" generic="T extends object">
type TableColumn = {
  key: string
  label: string
}

const props = defineProps<{
  columns: TableColumn[]
  rows: T[]
  rowKey: string | ((row: T) => string | number)
  clickableRows?: boolean
  detailRowKeys?: Array<string | number>
}>()

const emit = defineEmits<{
  rowClick: [row: T]
}>()

function getRowKey(row: T) {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(row)
  }
  return String((row as Record<string, unknown>)[props.rowKey] ?? '')
}

function hasDetailRow(row: T) {
  if (!props.detailRowKeys) {
    return true
  }
  return props.detailRowKeys.includes(getRowKey(row))
}

function onRowKeydown(event: KeyboardEvent, row: T) {
  if (!props.clickableRows || (event.key !== 'Enter' && event.key !== ' ')) {
    return
  }
  event.preventDefault()
  emit('rowClick', row)
}
</script>

<template>
  <div class="admin-data-table-wrap">
    <div
      v-if="$slots.header"
      class="admin-data-table-header"
    >
      <slot name="header" />
    </div>
    <table class="admin-data-table">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-if="!rows.length && $slots.empty"
          class="admin-data-table-empty-row"
        >
          <td :colspan="columns.length">
            <slot name="empty" />
          </td>
        </tr>
        <template
          v-for="row in rows"
          :key="getRowKey(row)"
        >
          <tr
            :class="{ 'is-clickable': clickableRows }"
            :tabindex="clickableRows ? 0 : undefined"
            @click="clickableRows && emit('rowClick', row)"
            @keydown="onRowKeydown($event, row)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              :data-label="column.label"
            >
              <slot
                :name="`cell-${column.key}`"
                :row="row"
                :value="(row as Record<string, unknown>)[column.key]"
              >
                {{ (row as Record<string, unknown>)[column.key] }}
              </slot>
            </td>
          </tr>
          <tr
            v-if="$slots.detail && hasDetailRow(row)"
            class="admin-data-table-detail-row"
          >
            <td :colspan="columns.length">
              <slot
                name="detail"
                :row="row"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
