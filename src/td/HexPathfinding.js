import { TileType, TILE_LIST } from '../hexmap/HexTileData.js'
import { cubeKey, cubeToOffset, offsetToCube, CUBE_DIRS } from '../hexmap/HexWFCCore.js'
import { HexTileGeometry } from '../hexmap/HexTiles.js'

const WALKABLE_TYPES = new Set()
for (let i = 0; i < TILE_LIST.length; i++) {
  const t = TILE_LIST[i]
  const edges = Object.values(t.edges)
  const hasWater = edges.includes('water')
  const isCoast = t.name.startsWith('COAST')
  if (!hasWater && !isCoast) {
    WALKABLE_TYPES.add(i)
  }
}
WALKABLE_TYPES.delete(TileType.WATER)

export function isWalkable(tileType) {
  return WALKABLE_TYPES.has(tileType)
}

export function findPath(globalCells, startCube, endCube, towerPositions = new Set()) {
  const startKey = cubeKey(startCube.q, startCube.r, startCube.s)
  const endKey = cubeKey(endCube.q, endCube.r, endCube.s)

  if (!globalCells.has(startKey) || !globalCells.has(endKey)) return null

  const openSet = new Map()
  const cameFrom = new Map()
  const gScore = new Map()
  const fScore = new Map()
  const closedSet = new Set()

  gScore.set(startKey, 0)
  fScore.set(startKey, heuristic(startCube, endCube))
  openSet.set(startKey, startCube)

  while (openSet.size > 0) {
    let currentKey = null
    let lowestF = Infinity
    for (const [key] of openSet) {
      const f = fScore.get(key) ?? Infinity
      if (f < lowestF) {
        lowestF = f
        currentKey = key
      }
    }

    if (currentKey === endKey) {
      return reconstructPath(cameFrom, currentKey)
    }

    const current = openSet.get(currentKey)
    openSet.delete(currentKey)
    closedSet.add(currentKey)

    for (const dir of CUBE_DIRS) {
      const nq = current.q + dir.dq
      const nr = current.r + dir.dr
      const ns = current.s + dir.ds
      const nKey = cubeKey(nq, nr, ns)

      if (closedSet.has(nKey)) continue

      const cell = globalCells.get(nKey)
      if (!cell) continue
      if (!isWalkable(cell.type)) continue
      if (towerPositions.has(nKey)) continue

      const levelDiff = Math.abs((cell.level || 0) - (globalCells.get(currentKey)?.level || 0))
      const moveCost = 1 + levelDiff * 0.5
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + moveCost

      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, currentKey)
        gScore.set(nKey, tentativeG)
        fScore.set(nKey, tentativeG + heuristic({ q: nq, r: nr, s: ns }, endCube))
        if (!openSet.has(nKey)) {
          openSet.set(nKey, { q: nq, r: nr, s: ns })
        }
      }
    }
  }

  return null
}

function heuristic(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2
}

function reconstructPath(cameFrom, currentKey) {
  const path = [currentKey]
  while (cameFrom.has(currentKey)) {
    currentKey = cameFrom.get(currentKey)
    path.unshift(currentKey)
  }
  return path
}

export function cubeKeyToWorld(key, globalCells) {
  const cell = globalCells.get(key)
  if (!cell) {
    const { q, r, s } = parseCubeKeyStr(key)
    const off = cubeToOffset(q, r, s)
    const pos = HexTileGeometry.getWorldPosition(off.col, off.row)
    return { x: pos.x, y: 1, z: pos.z }
  }
  const { q, r, s } = cell
  const off = cubeToOffset(q, r, s)
  const pos = HexTileGeometry.getWorldPosition(off.col, off.row)
  return { x: pos.x, y: 1 + (cell.level || 0) * 0.5, z: pos.z }
}

function parseCubeKeyStr(key) {
  const [q, r, s] = key.split(',').map(Number)
  return { q, r, s }
}

export function findSpawnAndGoalCells(globalCells) {
  const candidates = []
  for (const [key, cell] of globalCells) {
    if (!isWalkable(cell.type)) continue
    candidates.push({ key, cell })
  }

  if (candidates.length < 2) return null

  const edgeCells = candidates.filter(c => {
    const { q, r, s } = c.cell
    let neighborCount = 0
    for (const dir of CUBE_DIRS) {
      const nKey = cubeKey(q + dir.dq, r + dir.dr, s + dir.ds)
      if (globalCells.has(nKey)) neighborCount++
    }
    return neighborCount < 6
  })

  if (edgeCells.length < 2) return null

  const walkableKeys = new Set(candidates.map(c => c.key))
  const regions = floodFillRegions(edgeCells, walkableKeys, globalCells)

  let bestResult = null
  let bestDist = 0

  for (const region of regions) {
    if (region.length < 2) continue
    for (let i = 0; i < region.length; i++) {
      for (let j = i + 1; j < region.length; j++) {
        const a = region[i].cell
        const b = region[j].cell
        const dist = heuristic(a, b)
        if (dist > bestDist) {
          bestDist = dist
          bestResult = { spawn: region[i], goal: region[j] }
        }
      }
    }
  }

  return bestResult
}

function floodFillRegions(edgeCells, walkableKeys, globalCells) {
  const visited = new Set()
  const regions = []
  const edgeKeySet = new Set(edgeCells.map(c => c.key))
  const edgeMap = new Map(edgeCells.map(c => [c.key, c]))

  for (const start of edgeCells) {
    if (visited.has(start.key)) continue

    const region = []
    const queue = [start.key]
    visited.add(start.key)

    while (queue.length > 0) {
      const currentKey = queue.shift()
      if (edgeKeySet.has(currentKey)) {
        region.push(edgeMap.get(currentKey))
      }

      const { q, r, s } = parseCubeKeyStr(currentKey)
      for (const dir of CUBE_DIRS) {
        const nKey = cubeKey(q + dir.dq, r + dir.dr, s + dir.ds)
        if (visited.has(nKey)) continue
        if (!walkableKeys.has(nKey)) continue
        visited.add(nKey)
        queue.push(nKey)
      }
    }

    if (region.length >= 2) {
      regions.push(region)
    }
  }

  return regions
}
