export interface Differ {
  diffData: Record<string, any>
  applyDiff: Function
}
