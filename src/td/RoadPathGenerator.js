import { TileType } from '../hexmap/HexTileData.js'
import { CUBE_DIRS, cubeKey } from '../hexmap/HexWFCCore.js'
import { random } from '../SeededRandom.js'

const ROAD_A_DIRS = [1, 4]
const ROAD_B_DIRS = [0, 4]

function getRoadAEdges(rotation) {
  return [
    (ROAD_A_DIRS[0] + rotation) % 6,
    (ROAD_A_DIRS[1] + rotation) % 6,
  ]
}

function getRoadBEdges(rotation) {
  return [
    (ROAD_B_DIRS[0] + rotation) % 6,
    (ROAD_B_DIRS[1] + rotation) % 6,
  ]
}

function findRoadTile(dirIn, dirOut) {
  for (let rot = 0; rot < 6; rot++) {
    const [a, b] = getRoadAEdges(rot)
    if ((a === dirIn && b === dirOut) || (a === dirOut && b === dirIn)) {
      return { type: TileType.ROAD_A, rotation: rot }
    }
  }
  for (let rot = 0; rot < 6; rot++) {
    const [a, b] = getRoadBEdges(rot)
    if ((a === dirIn && b === dirOut) || (a === dirOut && b === dirIn)) {
      return { type: TileType.ROAD_B, rotation: rot }
    }
  }
  return null
}

function findEndCapTile(dirIn) {
  const endType = TileType.ROAD_END
  for (let rot = 0; rot < 6; rot++) {
    const roadDir = (4 + rot) % 6
    if (roadDir === dirIn) {
      return { type: endType, rotation: rot }
    }
  }
  return null
}

function cubeDistance(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s))
}

function getCubeDir(from, to) {
  const dq = to.q - from.q
  const dr = to.r - from.r
  const ds = to.s - from.s
  for (let i = 0; i < CUBE_DIRS.length; i++) {
    if (CUBE_DIRS[i].dq === dq && CUBE_DIRS[i].dr === dr && CUBE_DIRS[i].ds === ds) {
      return i
    }
  }
  return -1
}

function pickOppositeEdgeCells(allCellCoords, waterSideIndex) {
  const keySet = new Set(allCellCoords.map(c => cubeKey(c.q, c.r, c.s)))

  const edgeCells = allCellCoords.filter(c => {
    let neighborCount = 0
    for (const dir of CUBE_DIRS) {
      const nKey = cubeKey(c.q + dir.dq, c.r + dir.dr, c.s + dir.ds)
      if (keySet.has(nKey)) neighborCount++
    }
    return neighborCount < 6
  })

  if (edgeCells.length < 2) return null

  const waterDir = CUBE_DIRS[waterSideIndex]

  const awayFromWater = edgeCells.filter(c => {
    const dot = c.q * waterDir.dq + c.r * waterDir.dr + c.s * waterDir.ds
    return dot < 0
  })

  const perpDir = CUBE_DIRS[(waterSideIndex + 2) % 6]

  const sortByPerp = (cells) => {
    return [...cells].sort((a, b) => {
      const da = a.q * perpDir.dq + a.r * perpDir.dr + a.s * perpDir.ds
      const db = b.q * perpDir.dq + b.r * perpDir.dr + b.s * perpDir.ds
      return da - db
    })
  }

  const sortedAway = sortByPerp(awayFromWater.length > 0 ? awayFromWater : edgeCells)
  const start = sortedAway[Math.floor(sortedAway.length * 0.15)]
  const end = sortedAway[Math.floor(sortedAway.length * 0.85)]

  if (!start || !end || cubeKey(start.q, start.r, start.s) === cubeKey(end.q, end.r, end.s)) {
    return null
  }

  return { start, end }
}

function findPathBFS(start, end, validKeys) {
  const startKey = cubeKey(start.q, start.r, start.s)
  const endKey = cubeKey(end.q, end.r, end.s)

  const queue = [startKey]
  const cameFrom = new Map()
  cameFrom.set(startKey, null)

  while (queue.length > 0) {
    const currentKey = queue.shift()
    if (currentKey === endKey) break

    const [cq, cr, cs] = currentKey.split(',').map(Number)
    for (const dir of CUBE_DIRS) {
      const nKey = cubeKey(cq + dir.dq, cr + dir.dr, cs + dir.ds)
      if (!validKeys.has(nKey)) continue
      if (cameFrom.has(nKey)) continue
      cameFrom.set(nKey, currentKey)
      queue.push(nKey)
    }
  }

  if (!cameFrom.has(endKey)) return null

  const path = []
  let current = endKey
  while (current) {
    const [q, r, s] = current.split(',').map(Number)
    path.unshift({ q, r, s })
    current = cameFrom.get(current)
  }
  return path
}

function addRandomWaypoints(start, end, allCellCoords, waterSideIndex, count = 2) {
  const keySet = new Set(allCellCoords.map(c => cubeKey(c.q, c.r, c.s)))
  const waterDir = CUBE_DIRS[waterSideIndex]

  const nonWaterCells = allCellCoords.filter(c => {
    const dot = c.q * waterDir.dq + c.r * waterDir.dr + c.s * waterDir.ds
    return dot <= 0
  })

  if (nonWaterCells.length < 10) return [start, end]

  const midQ = (start.q + end.q) / 2
  const midR = (start.r + end.r) / 2
  const midS = (start.s + end.s) / 2

  const candidates = nonWaterCells.filter(c => {
    const dStart = cubeDistance(c, start)
    const dEnd = cubeDistance(c, end)
    return dStart > 3 && dEnd > 3
  })

  if (candidates.length === 0) return [start, end]

  const wpCount = Math.min(count, candidates.length)
  const waypoints = []
  const used = new Set()

  for (let i = 0; i < wpCount; i++) {
    let best = null
    let bestScore = -Infinity
    for (const c of candidates) {
      const ck = cubeKey(c.q, c.r, c.s)
      if (used.has(ck)) continue
      let minDistToUsed = Infinity
      for (const uk of used) {
        const [uq, ur, us] = uk.split(',').map(Number)
        const d = cubeDistance(c, { q: uq, r: ur, s: us })
        if (d < minDistToUsed) minDistToUsed = d
      }
      const dMid = cubeDistance(c, { q: Math.round(midQ), r: Math.round(midR), s: Math.round(midS) })
      const score = minDistToUsed - dMid * 0.3 + random() * 4
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    if (best) {
      waypoints.push(best)
      used.add(cubeKey(best.q, best.r, best.s))
    }
  }

  const perpDir = CUBE_DIRS[(waterSideIndex + 2) % 6]
  const sortByPerp = (a, b) => {
    const da = a.q * perpDir.dq + a.r * perpDir.dr + a.s * perpDir.ds
    const db = b.q * perpDir.dq + b.r * perpDir.dr + b.s * perpDir.ds
    return da - db
  }

  waypoints.sort(sortByPerp)
  return [start, ...waypoints, end]
}

export function generateRoadPath(allSolveCells, waterSideIndex, excludeKeys) {
  if (waterSideIndex == null) waterSideIndex = 0

  const filteredCells = excludeKeys && excludeKeys.size > 0
    ? allSolveCells.filter(c => !excludeKeys.has(cubeKey(c.q, c.r, c.s)))
    : allSolveCells

  const endpoints = pickOppositeEdgeCells(filteredCells, waterSideIndex)
  if (!endpoints) return null

  const { start, end } = endpoints
  const keySet = new Set(filteredCells.map(c => cubeKey(c.q, c.r, c.s)))

  const checkpoints = addRandomWaypoints(start, end, filteredCells, waterSideIndex, 2)

  let fullPath = []
  for (let i = 0; i < checkpoints.length - 1; i++) {
    const segment = findPathBFS(checkpoints[i], checkpoints[i + 1], keySet)
    if (!segment) return null
    if (i > 0) segment.shift()
    fullPath = fullPath.concat(segment)
  }

  if (fullPath.length < 3) return null

  const collapses = []
  const roadCubeKeys = []

  for (let i = 0; i < fullPath.length; i++) {
    const cell = fullPath[i]
    const prev = i > 0 ? fullPath[i - 1] : null
    const next = i < fullPath.length - 1 ? fullPath[i + 1] : null

    let dirIn = -1
    let dirOut = -1

    if (prev) {
      dirIn = getCubeDir(cell, prev)
    }
    if (next) {
      dirOut = getCubeDir(cell, next)
    }

    let tile = null
    if (dirIn >= 0 && dirOut >= 0) {
      tile = findRoadTile(dirIn, dirOut)
    } else if (dirIn >= 0) {
      tile = findEndCapTile(dirIn)
    } else if (dirOut >= 0) {
      tile = findEndCapTile(dirOut)
    }

    if (!tile) continue

    collapses.push({
      q: cell.q, r: cell.r, s: cell.s,
      type: tile.type,
      rotation: tile.rotation,
      level: 0,
    })

    roadCubeKeys.push(cubeKey(cell.q, cell.r, cell.s))
  }

  return { collapses, roadCubeKeys, path: fullPath }
}
