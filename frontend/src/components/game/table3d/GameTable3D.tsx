'use client'
/**
 * GameTable3D — Babylon.js renderer.
 *
 * ALL @babylonjs/core imports are done with a dynamic import() inside useEffect
 * so Next.js never tries to resolve/bundle the package on the server side.
 * `import type` is safe (erased at compile-time) and gives us TypeScript types.
 */

import { useRef, useEffect } from 'react'
import type { Card, TrickCard, PlayerPublicInfo, GameState } from '@/types/game.types'

// ── Type-only imports (erased at build, never cause module-not-found) ─────────
import type {
  Engine, Scene, GlowLayer, Mesh, Sound,
  DynamicTexture, StandardMaterial, PBRMaterial,
} from '@babylonjs/core'

// ── Public types (re-exported for page.tsx) ───────────────────────────────────
export interface TrickLayer { cards: TrickCard[]; winnerId: string | null }

export interface GameTable3DProps {
  currentTrick:    TrickCard[]
  trickHistory:    TrickLayer[]
  aiPlayers:       PlayerPublicInfo[]
  playerMap:       Record<string, PlayerPublicInfo>
  state:           GameState
  userId:          string
  isMyTurn:        boolean
  trickWinnerName: string
  lastTrick:       { trickNumber: number; winnerId: string } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────
const S2S: Record<number, number> = { 0: 0, 1: 3, 2: 2, 3: 1 }

const TRICK_POS: Record<number, [number, number, number]> = {
  0: [ 0,    0.14,  0.90],
  1: [ 1.10, 0.14,  0   ],
  2: [ 0,    0.14, -0.90],
  3: [-1.10, 0.14,  0   ],
}
const TRICK_PITCH: Record<number, number> = { 0: 12, 1: 6, 2: -12, 3: 6 }

const FAN_ORIGIN: Record<number, [number, number, number]> = {
  1: [ 3.0, 0.01,  0   ],
  2: [ 0,   0.01, -2.2 ],
  3: [-3.0, 0.01,  0   ],
}

function seededTilt(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return ((h >>> 0) / 4_294_967_296 - 0.5) * 0.10
}

// ── Scene state ───────────────────────────────────────────────────────────────
interface SceneState {
  engine:        Engine
  scene:         Scene
  cardMeshes:    Map<string, Mesh>
  glowLayer:     GlowLayer
  cardSound:     Sound | null
  winSound:      Sound | null
  roundWinSound: Sound | null
  yourTurnSound: Sound | null
  prevTrickKey:     string
  prevLastTrickNum: number | null
  prevIsMyTurn:     boolean
  // Babylon module reference (needed by renderCards)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BJS: any
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameTable3D(props: GameTable3DProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const stateRef   = useRef<SceneState | null>(null)
  const propsRef   = useRef(props)
  propsRef.current = props

  // Bootstrap: load Babylon dynamically (browser only) then build scene
  useEffect(() => {
    if (!canvasRef.current) return
    let disposed = false

    import('@babylonjs/core').then(BJS => {
      if (disposed || !canvasRef.current) return

      const s = buildScene(canvasRef.current, BJS)
      stateRef.current = s
      renderCards(s, propsRef.current)

      const onResize = () => s.engine.resize()
      window.addEventListener('resize', onResize)

      // Store cleanup in a closure variable so the return fn can call it
      ;(canvasRef.current as any).__bjsCleanup = () => {
        window.removeEventListener('resize', onResize)
        s.engine.dispose()
        stateRef.current = null
        _dtexKeys.clear()
      }
    })

    return () => {
      disposed = true
      const cleanup = (canvasRef.current as any)?.__bjsCleanup
      if (cleanup) cleanup()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render cards when props change
  useEffect(() => {
    if (!stateRef.current) return
    renderCards(stateRef.current, props)
  }, [
    props.currentTrick,
    props.trickHistory,
    props.aiPlayers,
    props.state,
    props.isMyTurn,
    props.lastTrick,
  ])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', background: 'transparent' }}
    />
  )
}

// ── Texture key cache (tracks which keys exist in the current scene) ──────────
const _dtexKeys = new Set<string>()

// ── Scene builder ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildScene(canvas: HTMLCanvasElement, B: any): SceneState {
  const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true })
  engine.setHardwareScalingLevel(1 / window.devicePixelRatio)

  const scene = new B.Scene(engine)
  scene.clearColor = new B.Color4(0, 0, 0, 0)

  // Camera — locked, matches original Three.js camera [0,6.2,5.8] fov:48
  const camera = new B.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.0, 9.4, B.Vector3.Zero(), scene)
  camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius
  camera.lowerBetaLimit   = camera.upperBetaLimit   = camera.beta
  camera.lowerAlphaLimit  = camera.upperAlphaLimit  = camera.alpha

  // Lights
  const amb = new B.HemisphericLight('amb', new B.Vector3(0, 1, 0), scene)
  amb.intensity = 1.0; amb.diffuse = B.Color3.FromHexString('#d0e8ff')

  const dir = new B.DirectionalLight('dir', new B.Vector3(0, -1, -0.2), scene)
  dir.position = new B.Vector3(0, 11, 0.5); dir.intensity = 3.0
  dir.diffuse = B.Color3.FromHexString('#fff8e0')

  const pts: Array<[[number,number,number], string]> = [
    [[-8, 5, -5], '#00ffe0'], [[ 8, 5, -5], '#cc44ff'],
    [[ 0, 3, 10], '#ff8800'], [[ 0, 7, -9], '#44aaff'],
    [[ 0, -0.2, 0], '#00ff88'],
  ]
  pts.forEach(([pos, hex], i) => {
    const pl = new B.PointLight(`pl${i}`, new B.Vector3(...pos), scene)
    pl.diffuse = B.Color3.FromHexString(hex); pl.intensity = 2.2; pl.range = 24
  })

  // GlowLayer
  const glowLayer = new B.GlowLayer('glow', scene)
  glowLayer.intensity = 1.4

  // ── Casino table meshes ──
  const feltDisc = B.MeshBuilder.CreateDisc('felt', { radius: 4.9, tessellation: 80 }, scene)
  feltDisc.rotation.x = Math.PI / 2
  const feltMat = new B.StandardMaterial('feltMat', scene)
  feltMat.diffuseTexture  = makeFeltTex(scene, B)
  feltMat.emissiveColor   = B.Color3.FromHexString('#0d3b1e').scale(0.15)
  feltDisc.material = feltMat

  const innerRing = B.MeshBuilder.CreateTorus('innerRing', { diameter: 9.68, thickness: 0.12, tessellation: 80 }, scene)
  innerRing.position.y = 0.001
  const irMat = new B.StandardMaterial('irm', scene)
  irMat.diffuseColor  = B.Color3.FromHexString('#0e4024')
  irMat.emissiveColor = B.Color3.FromHexString('#052010').scale(0.2)
  innerRing.material = irMat

  // Gold torus rim (PBR — photorealistic metallic)
  const torus = B.MeshBuilder.CreateTorus('rim', { diameter: 10.04, thickness: 0.28, tessellation: 80 }, scene)
  torus.position.y = 0.15
  const torusMat = new B.PBRMaterial('rimMat', scene)
  torusMat.albedoColor   = B.Color3.FromHexString('#e8c558')
  torusMat.metallic      = 0.85
  torusMat.roughness     = 0.12
  torusMat.emissiveColor = B.Color3.FromHexString('#b8860b').scale(0.5)
  torus.material = torusMat
  glowLayer.addIncludedOnlyMesh(torus)

  const wood = B.MeshBuilder.CreateDisc('wood', { radius: 6.2, tessellation: 80 }, scene)
  wood.rotation.x = Math.PI / 2; wood.position.y = -0.03
  const woodMat = new B.StandardMaterial('woodMat', scene)
  woodMat.diffuseColor = B.Color3.FromHexString('#5c2d0a')
  wood.material = woodMat

  // Animated floor halo
  const halo = B.MeshBuilder.CreateTorus('halo', { diameter: 12.0, thickness: 0.80, tessellation: 80 }, scene)
  halo.position.y = -0.07
  const haloMat = new B.StandardMaterial('haloMat', scene)
  haloMat.emissiveColor = B.Color3.FromHexString('#0066ff')
  haloMat.alpha = 0.6
  halo.material = haloMat
  glowLayer.addIncludedOnlyMesh(halo)

  // Animated table edge glow
  const edgeGlow = B.MeshBuilder.CreateTorus('edge', { diameter: 10.16, thickness: 0.09, tessellation: 80 }, scene)
  edgeGlow.position.y = 0.20
  const egMat = new B.StandardMaterial('egm', scene)
  egMat.emissiveColor = B.Color3.FromHexString('#ffaa00')
  egMat.alpha = 0.9
  edgeGlow.material = egMat
  glowLayer.addIncludedOnlyMesh(edgeGlow)

  let t = 0
  scene.registerBeforeRender(() => {
    t += engine.getDeltaTime() * 0.001
    haloMat.alpha = 0.45 + Math.sin(t * 0.9) * 0.18
    haloMat.emissiveColor = B.Color3.FromHexString('#0066ff').scale(1.8 + Math.sin(t * 1.4) * 0.6)
    egMat.emissiveColor   = B.Color3.FromHexString('#ffaa00').scale(1.2 + Math.sin(t * 2.1 + 1) * 0.5)
  })

  // ── Audio ──
  function trySound(name: string, file: string, vol: number): Sound | null {
    try { return new B.Sound(name, `/sounds/${file}`, scene, null, { loop: false, autoplay: false, volume: vol }) }
    catch { return null }
  }
  const cardSound     = trySound('card',     'card-play.wav', 0.65)
  const winSound      = trySound('win',      'trick-win.wav', 0.75)
  const roundWinSound = trySound('roundWin', 'round-win.wav', 0.85)
  const yourTurnSound = trySound('yourTurn', 'your-turn.wav', 0.60)

  engine.runRenderLoop(() => scene.render())

  return {
    engine, scene,
    cardMeshes: new Map(),
    glowLayer,
    cardSound, winSound, roundWinSound, yourTurnSound,
    prevTrickKey: '', prevLastTrickNum: null, prevIsMyTurn: false,
    BJS: B,
  }
}

// ── Texture factories (keyed inside the scene via DynamicTexture name) ────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFaceTex(scene: any, B: any, rank: string, suit: string): any {
  const k = `ft_${rank}_${suit}`
  if (_dtexKeys.has(k)) return scene.getTextureByName(k)
  const dt = new B.DynamicTexture(k, { width: 240, height: 336 }, scene, false)
  const c  = dt.getContext() as CanvasRenderingContext2D
  const red = suit === 'hearts' || suit === 'diamonds'
  const col = red ? '#c0392b' : '#1a1a2e'
  const SYM: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
  const sym = SYM[suit]
  const bg = c.createLinearGradient(0, 0, 0, 336)
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#f7f3ec')
  c.fillStyle = bg; c.beginPath(); c.roundRect(2, 2, 236, 332, 14); c.fill()
  c.strokeStyle = '#ddd8d0'; c.lineWidth = 2
  c.beginPath(); c.roundRect(3, 3, 234, 330, 13); c.stroke()
  c.fillStyle = col
  c.font = 'bold 38px Georgia,serif'; c.fillText(rank, 12, 46)
  c.font = '30px Georgia,serif'; c.fillText(sym, 14, 80)
  c.globalAlpha = 0.13; c.font = '130px Georgia,serif'; c.fillText(sym, 28, 224); c.globalAlpha = 1
  c.save(); c.translate(228, 296); c.rotate(Math.PI)
  c.font = 'bold 38px Georgia,serif'; c.fillText(rank, 0, 0); c.restore()
  dt.update(); _dtexKeys.add(k); return dt
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBackTex(scene: any, B: any): any {
  const k = 'bt_back'
  if (_dtexKeys.has(k)) return scene.getTextureByName(k)
  const dt = new B.DynamicTexture(k, { width: 240, height: 336 }, scene, false)
  const c  = dt.getContext() as CanvasRenderingContext2D
  const bg = c.createLinearGradient(0, 0, 240, 336)
  bg.addColorStop(0, '#0f1b4c'); bg.addColorStop(0.5, '#1a2e7a'); bg.addColorStop(1, '#0d1640')
  c.fillStyle = bg; c.beginPath(); c.roundRect(2, 2, 236, 332, 14); c.fill()
  c.strokeStyle = '#d4a843'; c.lineWidth = 3.5
  c.beginPath(); c.roundRect(4, 4, 232, 328, 12); c.stroke()
  c.strokeStyle = 'rgba(212,168,67,0.4)'; c.lineWidth = 1.5
  c.beginPath(); c.roundRect(11, 11, 218, 314, 8); c.stroke()
  c.strokeStyle = 'rgba(255,255,255,0.055)'; c.lineWidth = 1
  for (let i = -336; i < 580; i += 18) {
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 336, 336); c.stroke()
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i - 336, 336); c.stroke()
  }
  c.strokeStyle = 'rgba(212,168,67,0.75)'; c.lineWidth = 2
  c.beginPath(); c.arc(120, 168, 36, 0, Math.PI * 2); c.stroke()
  c.beginPath(); c.arc(120, 168, 28, 0, Math.PI * 2); c.stroke()
  c.fillStyle = 'rgba(212,168,67,0.9)'; c.font = 'bold 28px Arial'; c.textAlign = 'center'
  c.fillText('✦', 120, 178); c.textAlign = 'left'
  dt.update(); _dtexKeys.add(k); return dt
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFeltTex(scene: any, B: any): any {
  const k = 'ft_felt'
  if (_dtexKeys.has(k)) return scene.getTextureByName(k)
  const dt = new B.DynamicTexture(k, { width: 512, height: 512 }, scene, false)
  const c  = dt.getContext() as CanvasRenderingContext2D
  const g = c.createRadialGradient(256, 256, 0, 256, 256, 380)
  g.addColorStop(0,    '#2ecc71'); g.addColorStop(0.4,  '#27ae60')
  g.addColorStop(0.75, '#1d8348'); g.addColorStop(1,    '#145a32')
  c.fillStyle = g; c.fillRect(0, 0, 512, 512)
  c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 0.5
  for (let i = 0; i < 512; i += 5) {
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.stroke()
    c.beginPath(); c.moveTo(0, i); c.lineTo(512, i); c.stroke()
  }
  dt.update(); _dtexKeys.add(k); return dt
}

// ── Card mesh factory ─────────────────────────────────────────────────────────
function createCardMesh(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  B: any, key: string, scene: any, glowLayer: any,
  card: Card | undefined, faceDown: boolean,
  pos: [number, number, number], yaw: number, pitch: number,
  scale: number, opacity: number, glow: boolean,
): Mesh {
  const mesh = B.MeshBuilder.CreatePlane(key, { width: 0.78, height: 1.09 }, scene)
  mesh.position   = new B.Vector3(pos[0], pos[1], pos[2])
  mesh.rotation.x = -Math.PI / 2 + pitch * Math.PI / 180
  mesh.rotation.z = yaw
  mesh.scaling    = new B.Vector3(scale, scale, 1)

  const mat = new B.PBRMaterial(`${key}Mat`, scene)
  mat.backFaceCulling = false
  mat.roughness = 0.35
  mat.metallic  = 0.0
  mat.albedoTexture = faceDown || !card
    ? makeBackTex(scene, B)
    : makeFaceTex(scene, B, card.rank, card.suit)

  if (opacity < 1) {
    mat.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND
    mat.alpha = opacity
  }
  if (glow) {
    mat.emissiveColor = B.Color3.FromHexString('#f59e0b').scale(0.6)
    glowLayer.addIncludedOnlyMesh(mesh)
  }
  mesh.material = mat
  return mesh
}

// ── Card renderer ─────────────────────────────────────────────────────────────
function renderCards(s: SceneState, p: GameTable3DProps) {
  const { scene, cardMeshes, glowLayer, BJS: B } = s

  type CardSpec = {
    card?: Card; faceDown: boolean
    pos: [number,number,number]; yaw: number; pitch: number
    scale: number; opacity: number; glow: boolean
  }
  const desired = new Map<string, CardSpec>()

  // 1. AI card fans
  p.aiPlayers.forEach(player => {
    const screen = S2S[player.position] ?? 1
    if (screen === 0) return
    const played  = p.state.currentTrick.some(tc => tc.playerId === player.id) ? 1 : 0
    const count   = Math.max(0, 13 - (p.state.trickNumber - 1) - played)
    const origin  = FAN_ORIGIN[screen]
    const isEW    = screen === 1 || screen === 3
    const n       = Math.min(count, 13)
    for (let i = 0; i < n; i++) {
      const mid = (n - 1) / 2
      desired.set(`ai-${player.id}-${i}`, {
        faceDown: true,
        pos:  [origin[0] + (i - mid) * (isEW ? 0 : 0.20),
               origin[1] + i * 0.0007,
               origin[2] + (i - mid) * (isEW ? 0.20 : 0)],
        yaw:   (isEW ? Math.PI / 2 : 0) + (i - mid) * 0.055,
        pitch: 0, scale: 0.9, opacity: 1, glow: false,
      })
    }
  })

  // 2. Hidden rung
  if (p.state.hasHiddenRung) {
    desired.set('hiddenRung', { faceDown: true, pos: [2.1, 0.06, 0.25], yaw: 0.2, pitch: 0, scale: 0.9, opacity: 1, glow: false })
  }

  // 3. Ghost slots
  if (p.state.phase === 'playing') {
    const played = new Set<number>()
    p.currentTrick.forEach(tc => {
      const pp = p.playerMap[tc.playerId]; played.add(S2S[pp?.position ?? 0] ?? 0)
    })
    ;([0, 1, 2, 3] as const).forEach(screen => {
      if (played.has(screen)) return
      const [x, , z] = TRICK_POS[screen]
      desired.set(`slot-${screen}`, { faceDown: false, pos: [x, 0.005, z], yaw: 0, pitch: 0, scale: 1, opacity: 0.10, glow: false })
    })
  }

  // 4. Trick history
  p.trickHistory.forEach((layer, li) => {
    const depth   = p.trickHistory.length - 1 - li
    const isTop   = depth === 0
    const opacity = isTop ? 0.70 : Math.max(0.08, 0.35 - depth * 0.08)
    const off     = depth * 0.018
    layer.cards.forEach(tc => {
      const screen = S2S[p.playerMap[tc.playerId]?.position ?? 0] ?? 0
      const base   = TRICK_POS[screen]
      desired.set(`hist-${li}-${tc.playerId}`, {
        card: tc.card, faceDown: false,
        pos:  [base[0]+off, base[1]-0.01+li*0.002, base[2]+off],
        yaw:  seededTilt(tc.card.rank + tc.card.suit + screen),
        pitch: TRICK_PITCH[screen] * 0.5,
        scale: isTop ? 1.15 : 0.95, opacity, glow: false,
      })
    })
  })

  // 5. Live trick cards
  const newTrickKey = p.currentTrick.map(tc => tc.playerId + tc.card.rank + tc.card.suit).join('|')
  const trickChanged = newTrickKey !== s.prevTrickKey
  s.prevTrickKey = newTrickKey

  p.currentTrick.forEach(tc => {
    const screen = S2S[p.playerMap[tc.playerId]?.position ?? 0] ?? 0
    desired.set(`live-${tc.playerId}`, {
      card: tc.card, faceDown: false,
      pos:  TRICK_POS[screen],
      yaw:  seededTilt(tc.card.rank + tc.card.suit + screen),
      pitch: TRICK_PITCH[screen], scale: 1.45, opacity: 1, glow: false,
    })
  })

  // 6. My-turn glow ring
  if (p.isMyTurn && p.state.phase === 'playing' && p.currentTrick.length === 0) {
    const [x, y, z] = TRICK_POS[0]
    desired.set('glow-ring', { faceDown: false, pos: [x, y, z], yaw: 0, pitch: 0, scale: 1, opacity: 0.5, glow: true })
  }

  // Diff: remove stale
  const toRemove: string[] = []
  cardMeshes.forEach((_, key) => { if (!desired.has(key)) toRemove.push(key) })
  toRemove.forEach(key => {
    const mesh = cardMeshes.get(key)!
    mesh.material?.dispose(); mesh.dispose()
    cardMeshes.delete(key)
  })

  // Diff: add new
  desired.forEach((spec, key) => {
    if (cardMeshes.has(key)) return
    cardMeshes.set(key, createCardMesh(
      B, key, scene, glowLayer,
      spec.card, spec.faceDown,
      spec.pos, spec.yaw, spec.pitch,
      spec.scale, spec.opacity, spec.glow,
    ))
  })

  // SFX
  if (trickChanged && p.currentTrick.length > 0 && s.cardSound) {
    try { s.cardSound.play() } catch {}
  }
  const latestTrick = p.lastTrick?.trickNumber ?? null
  if (latestTrick !== null && latestTrick !== s.prevLastTrickNum) {
    s.prevLastTrickNum = latestTrick
    const snd = latestTrick === 13 ? s.roundWinSound : s.winSound
    try { snd?.play() } catch {}
  }
  if (p.isMyTurn && !s.prevIsMyTurn && s.yourTurnSound) {
    try { s.yourTurnSound.play() } catch {}
  }
  s.prevIsMyTurn = p.isMyTurn
}
