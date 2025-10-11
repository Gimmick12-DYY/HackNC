export class DisjointSet<T> {
  private readonly index = new Map<T, number>();
  private readonly parent: number[] = [];
  private readonly rank: number[] = [];
  private readonly items: T[] = [];

  add(item: T) {
    if (this.index.has(item)) return;
    const idx = this.items.length;
    this.index.set(item, idx);
    this.items.push(item);
    this.parent.push(idx);
    this.rank.push(0);
  }

  has(item: T) {
    return this.index.has(item);
  }

  private findIndex(idx: number): number {
    if (this.parent[idx] !== idx) {
      this.parent[idx] = this.findIndex(this.parent[idx]);
    }
    return this.parent[idx];
  }

  union(a: T, b: T) {
    if (!this.has(a) || !this.has(b)) return;
    const aIdx = this.index.get(a)!;
    const bIdx = this.index.get(b)!;
    const rootA = this.findIndex(aIdx);
    const rootB = this.findIndex(bIdx);
    if (rootA === rootB) return;
    const rankA = this.rank[rootA];
    const rankB = this.rank[rootB];
    if (rankA < rankB) {
      this.parent[rootA] = rootB;
    } else if (rankA > rankB) {
      this.parent[rootB] = rootA;
    } else {
      this.parent[rootB] = rootA;
      this.rank[rootA] += 1;
    }
  }

  findRepresentative(item: T): T | undefined {
    if (!this.has(item)) return undefined;
    const idx = this.index.get(item)!;
    const rootIdx = this.findIndex(idx);
    return this.items[rootIdx];
  }

  getGroups(): Map<T, T[]> {
    const groups = new Map<T, T[]>();
    this.items.forEach((item) => {
      const rep = this.findRepresentative(item);
      if (rep === undefined) return;
      const list = groups.get(rep);
      if (list) {
        list.push(item);
      } else {
        groups.set(rep, [item]);
      }
    });
    return groups;
  }
}
