'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import SafeQRCode from '@/components/SafeQRCode'
import { supabase } from '@/lib/supabase'
import { getErrorMetadata } from '@/lib/error-codes'

// ── Types ─────────────────────────────────────────────────────
type Stats = {
  totalMachines: number
  onlineMachines: number
  offlineMachines: number
  revenueToday: number
  ordersToday: number
  walletRedemptionToday: number
  walletOrdersToday: number
  totalSalesToday: number
  revenueMonth: number
  ordersMonth: number
  walletRedemptionMonth: number
  walletOrdersMonth: number
  totalSalesMonth: number
  coffeeToday: number
  activeCustomers: number
  totalWalletCredit: number
  productStats: { name: string; full: number; half: number; total: number }[]
  sizeStats: { full: number; half: number }
  revenueTrend: { date: string; revenue: number; directRevenue?: number; walletRedemption?: number; orders?: number; walletOrders?: number }[]
}
type Machine = { id:string; machine_code:string; machine_name:string; location:string; status:string; last_seen:string; firmware_version:string }
type AlertItem = { id:string; machineId:string; errorCode:string; details?:string; timestamp:string; resolved:boolean }
type Transaction = { id:string; order_id:string; payment_amount:number; payment_status:string; phone:string; created_at:string; products:{name:string;price:number}[] }
type Token = { id:string; token:string; status:string; created_at:string; expires_at:string; redeemed_at:string|null; order_id?:string; phone?:string|null; is_half?:boolean; user_id?:string|null; products:{id?:string; name:string; price?:number}|null }
type Product = { id?:string; name:string; description:string; price:number; active:boolean; relay_id:number; dispense_time_ms:number; allow_half:boolean; half_price:number }
type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatar_url?: string | null
  created_at: string
  wallet_balance: number
  total_spent: number
  direct_spent?: number
  wallet_spent?: number
  order_count?: number
  last_order_at?: string | null
  recent_orders?: Array<{
    id: string
    order_id: string
    payment_id: string
    payment_amount: number
    created_at: string
  }>
}

// ── Styles ────────────────────────────────────────────────────
const C = { bg:'#070504', side:'#0A0806', card:'rgba(255,255,255,0.04)', border:'rgba(200,146,42,0.14)', gold:'#C8922A', goldL:'#E5A93C', cream:'#F5F0E8', muted:'#C4B99A', green:'#22c55e', red:'#ef4444', yellow:'#f59e0b', font:"'Outfit',sans-serif" }
const card = { background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'18px 20px' }
const badge = (color:string) => ({ background:`${color}18`, color, fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, display:'inline-block' as const })
const btnGold = { background:`linear-gradient(135deg,${C.goldL},${C.gold})`, border:'none', borderRadius:10, padding:'8px 16px', color:'#0D0A08', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:C.font }
const btnGhost = { background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:10, padding:'7px 14px', color:C.muted, fontSize:12, cursor:'pointer', fontFamily:C.font }

const NAV = [
  { id:'dashboard',    label:'Dashboard',     icon:'▦' },
  { id:'products',     label:'Products',      icon:'☕' },
  { id:'machines',     label:'Machines',      icon:'⊡' },
  { id:'inventory',    label:'Inventory',     icon:'▤' },
  { id:'transactions', label:'Transactions',  icon:'⊟' },
  { id:'tokens',       label:'Tokens',        icon:'◈' },
  { id:'customers',    label:'Customers',     icon:'◉' },
  { id:'alerts',       label:'Alerts',        icon:'⚠' },
  { id:'events',       label:'Event Logs',    icon:'≡' },
  { id:'firmware',     label:'Firmware',      icon:'↑' },
  { id:'reports',      label:'Reports',       icon:'↗' },
]

function fmt(iso:string){ return new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) }
function rupee(p:number){ return `₹${(p/100).toFixed(0)}` }
function ago(iso:string){ const s=Math.floor((Date.now()-new Date(iso).getTime())/1000); if(s<60) return `${s}s ago`; if(s<3600) return `${Math.floor(s/60)}m ago`; return `${Math.floor(s/3600)}h ago` }

// ── KPI Card ─────────────────────────────────────────────────
function KPI({ label, value, sub, color='#C8922A' }:{ label:string; value:string; sub?:string; color?:string }) {
  return (
    <div style={{ ...card, minWidth:140 }}>
      <p style={{ color:C.muted, fontSize:11, textTransform:'uppercase', letterSpacing:1.5, marginBottom:10 }}>{label}</p>
      <p style={{ color, fontSize:28, fontWeight:800 }}>{value}</p>
      {sub && <p style={{ color:C.muted, fontSize:12, marginTop:4 }}>{sub}</p>}
    </div>
  )
}

// ── Placeholder section for future modules ────────────────────
function PlaceholderSection({ title, desc, items }:{ title:string; desc:string; items:{icon:string;label:string;note:string}[] }) {
  return (
    <div>
      <h2 style={{ color:C.cream, fontSize:22, fontWeight:700, marginBottom:6 }}>{title}</h2>
      <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>{desc}</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
        {items.map(it => (
          <div key={it.label} style={{ ...card, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:28 }}>{it.icon}</div>
            <p style={{ color:C.cream, fontWeight:600, fontSize:14 }}>{it.label}</p>
            <p style={{ color:C.muted, fontSize:12 }}>{it.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────
function DashboardSection() {
  const [stats,setStats]=useState<Stats|null>(null)
  const [txns,setTxns]=useState<Transaction[]>([])
  useEffect(()=>{
    const t = Date.now()
    fetch(`/api/admin/stats?_t=${t}`).then(r=>r.json()).then(setStats)
    fetch(`/api/admin/transactions?_t=${t}`).then(r=>r.json()).then(d=>setTxns((d.transactions??[]).slice(0,8)))
  },[])
  if(!stats) return <p style={{color:C.muted}}>Loading...</p>
  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      <div className="kpi-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
        <KPI label="Revenue Today (Direct)"     value={rupee(stats.revenueToday)}  sub={`${stats.ordersToday} gateway orders`} color={C.green} />
        <KPI label="Wallet Redemption (Today)"  value={rupee(stats.walletRedemptionToday || 0)} sub={`${stats.walletOrdersToday || 0} wallet orders`} color="#c084fc" />
        <KPI label="Total Sales Value (Today)"  value={rupee(stats.totalSalesToday || (stats.revenueToday + (stats.walletRedemptionToday || 0)))} sub={`${stats.ordersToday + (stats.walletOrdersToday || 0)} total orders`} color={C.goldL} />
        <KPI label="Revenue Month (Direct)"     value={rupee(stats.revenueMonth)} sub={`${stats.ordersMonth || 0} gateway orders`} color={C.gold} />
        <KPI label="Wallet Redemptions (Month)" value={rupee(stats.walletRedemptionMonth || 0)} sub={`${stats.walletOrdersMonth || 0} wallet orders`} color="#a855f7" />
        <KPI label="Coffee Dispensed"           value={`${stats.coffeeToday}`}     sub="today" color='#38bdf8' />
        <KPI label="Machines Online"            value={`${stats.onlineMachines}/${stats.totalMachines}`} color={stats.onlineMachines>0?C.green:C.red} sub={`${stats.offlineMachines} offline`} />
        <KPI label="Active Customers"           value={`${stats.activeCustomers}`} sub="this month" color='#60a5fa' />
        <KPI label="Total Given Credit"         value={rupee(stats.totalWalletCredit)} color="#34d399" sub="Lifetime promo credit" />
      </div>

      <div className="chart-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:24}}>
        {/* Product Sales Breakdown */}
        <div style={card}>
          <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1.5,marginBottom:14}}>Top Products (This Month)</p>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {stats.productStats.slice(0,5).map(p => {
              const max = Math.max(...stats.productStats.map(x=>x.total), 1)
              const pct = (p.total / max) * 100
              return (
                <div key={p.name}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                    <span style={{color:C.cream}}>{p.name}</span>
                    <span style={{color:C.gold,fontWeight:700}}>{p.total} cups</span>
                  </div>
                  <div style={{width:'100%',height:6,background:'rgba(255,255,255,0.05)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:'100%',background:C.goldL,borderRadius:3}} />
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:C.muted,marginTop:4}}>
                    <span>{p.full} Full</span>
                    <span>{p.half} Half</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Size Split & Revenue Trend */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>
          <div style={{...card,display:'flex',alignItems:'center',gap:20}}>
            <div style={{flex:1}}>
              <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1.5,marginBottom:6}}>Size Preferences</p>
              <div style={{display:'flex',alignItems:'flex-end',gap:12}}>
                <div><span style={{color:C.cream,fontSize:24,fontWeight:700}}>{stats.sizeStats.full}</span> <span style={{color:C.muted,fontSize:12}}>Full</span></div>
                <div><span style={{color:C.goldL,fontSize:24,fontWeight:700}}>{stats.sizeStats.half}</span> <span style={{color:C.muted,fontSize:12}}>Half</span></div>
              </div>
            </div>
            <div style={{width:60,height:60,borderRadius:'50%',background:`conic-gradient(${C.goldL} 0% ${(stats.sizeStats.half/(stats.sizeStats.full+stats.sizeStats.half||1))*100}%, rgba(255,255,255,0.1) 0)`}} />
          </div>

          <div style={{...card,flex:1}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
              <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1.5}}>7-Day Revenue Trend</p>
              <div style={{display:'flex',gap:12,fontSize:10}}>
                <span style={{display:'flex',alignItems:'center',gap:4,color:C.gold}}><span style={{width:8,height:8,borderRadius:2,background:C.gold}} /> Direct Gateway</span>
                <span style={{display:'flex',alignItems:'center',gap:4,color:'#c084fc'}}><span style={{width:8,height:8,borderRadius:2,background:'#c084fc'}} /> Wallet Redemption</span>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',height:86,gap:6}}>
              {stats.revenueTrend.map((t,i) => {
                const direct = t.directRevenue ?? t.revenue ?? 0
                const wallet = t.walletRedemption ?? 0
                const max = Math.max(...stats.revenueTrend.map(x => Math.max(x.directRevenue ?? x.revenue ?? 0, x.walletRedemption ?? 0)), 1)
                const directH = Math.max((direct / max) * 100, direct > 0 ? 6 : 0)
                const walletH = Math.max((wallet / max) * 100, wallet > 0 ? 6 : 0)

                return (
                  <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,flex:1}} title={`${t.date}\nDirect: ${rupee(direct)}\nWallet: ${rupee(wallet)}\nTotal: ${rupee(direct + wallet)}`}>
                    <div style={{width:'100%',height:86,display:'flex',alignItems:'flex-end',justifyContent:'center',gap:2}}>
                      <div style={{width:'45%',height:`${directH}%`,background:direct>0?C.gold:'rgba(255,255,255,0.05)',borderRadius:'3px 3px 0 0'}} />
                      <div style={{width:'45%',height:`${walletH}%`,background:wallet>0?'#c084fc':'rgba(255,255,255,0.03)',borderRadius:'3px 3px 0 0'}} />
                    </div>
                    <span style={{fontSize:9,color:C.muted}}>{t.date.slice(5,10)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={card}>
        <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1.5,marginBottom:14}}>Recent Transactions</p>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{color:C.muted}}>
              {['Time','Order ID','Products','Amount','Status'].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'6px 12px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{txns.map(tx=>(
              <tr key={tx.id} style={{borderTop:`1px solid rgba(255,255,255,0.04)`}}>
                <td style={{padding:'10px 12px',color:C.muted,fontSize:12}}>{fmt(tx.created_at)}</td>
                <td style={{padding:'10px 12px',color:C.cream,fontFamily:'monospace',fontSize:11}}>{tx.order_id.slice(0,18)}…</td>
                <td style={{padding:'10px 12px',color:C.cream}}>{tx.products?.map(p=>p.name).join(', ')||'—'}</td>
                <td style={{padding:'10px 12px',color:C.gold,fontWeight:700}}>{rupee(tx.payment_amount)}</td>
                <td style={{padding:'10px 12px'}}><span style={badge(tx.payment_status==='paid'?C.green:C.red)}>{tx.payment_status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Machines ──────────────────────────────────────────────────
function MachinesSection({ machines, alerts, onRefresh }:{ machines:Machine[]; alerts:AlertItem[]; onRefresh:()=>void }) {
  const [showFlushModal, setShowFlushModal] = useState(false)
  const toggle = async (m:Machine) => {
    // If in maintenance or offline, enabling sets it to online. If online, disables to offline.
    const next = m.status === 'online' ? 'offline' : 'online'
    await fetch('/api/admin/machines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId: m.id, status: next })
    })
    onRefresh()
  }

  const getStatusBadge = (status: string) => {
    if (status === 'online') return <span style={badge(C.green)}>ONLINE</span>
    if (status === 'maintenance') return <span style={{ ...badge(C.red), boxShadow: `0 0 8px ${C.red}66` }}>MAINTENANCE (ERROR)</span>
    return <span style={badge(C.yellow)}>OFFLINE</span>
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{color:C.cream,fontSize:22,fontWeight:700}}>Machine Management</h2>
          <p style={{color:C.muted,fontSize:12,marginTop:2}}>Auto-flush: triggers every 2 hours if drinks dispensed (10s rinse cycle)</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={() => setShowFlushModal(true)} style={{...btnGhost,borderColor:C.gold,color:C.goldL,display:'flex',alignItems:'center',gap:6}}>
            <span>💧</span> Hygiene Flush QR
          </button>
          <button onClick={onRefresh} style={btnGhost}>↻ Refresh</button>
        </div>
      </div>

      {/* Flush QR Modal */}
      {showFlushModal && (
        <div style={{
          position:'fixed',top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',
          zIndex:1000,backdropFilter:'blur(4px)',padding:20
        }}>
          <div style={{
            background:'#0D0A08',border:`1px solid ${C.gold}`,borderRadius:20,padding:'28px 24px',
            maxWidth:380,width:'100%',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:16,
            boxShadow:'0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{fontSize:36}}>💧</div>
            <h3 style={{color:C.cream,fontSize:20,fontWeight:700}}>Staff Hygiene Flush QR</h3>
            <p style={{color:C.muted,fontSize:13,lineHeight:1.4}}>
              Point this QR code at the machine scanner. It immediately executes the <strong>4× Relay 5 + 1× Relay 1</strong> combination and runs a 10-second hot water cleaning cycle.
            </p>
            <SafeQRCode value="CPOS-FLUSH" size={180} />
            <span style={{fontFamily:'monospace',fontSize:12,color:C.goldL,background:'rgba(255,255,255,0.06)',padding:'4px 12px',borderRadius:6}}>
              TOKEN: CPOS-FLUSH
            </span>
            <button onClick={() => setShowFlushModal(false)} style={{...btnGold,width:'100%',marginTop:8}}>
              Close
            </button>
          </div>
        </div>
      )}

      <div style={{overflowX:'auto',...card,padding:0}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted,background:'rgba(255,255,255,0.02)'}}>
            {['Machine ID','Name','Location','Status & Active Error','Last Heartbeat','Firmware','Action'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{machines.map(m => {
            const activeAlert = alerts.find(a => a.machineId === m.machine_code && !a.resolved)
            const meta = activeAlert ? getErrorMetadata(activeAlert.errorCode) : null
            return (
              <tr key={m.id} style={{borderTop:`1px solid rgba(255,255,255,0.04)`, background: m.status === 'maintenance' ? 'rgba(239,68,68,0.06)' : undefined}}>
                <td style={{padding:'12px 16px',color:C.cream,fontFamily:'monospace',fontSize:12}}>{m.machine_code}</td>
                <td style={{padding:'12px 16px',color:C.cream,fontWeight:600}}>{m.machine_name}</td>
                <td style={{padding:'12px 16px',color:C.muted}}>{m.location}</td>
                <td style={{padding:'12px 16px'}}>
                  <div>
                    {getStatusBadge(m.status)}
                    {m.status === 'maintenance' && (
                      <div style={{marginTop: 6, display:'flex', flexDirection:'column', gap:3}}>
                        <span style={{
                          display:'inline-flex',
                          alignItems:'center',
                          gap:4,
                          background:'rgba(239,68,68,0.2)',
                          border:'1px solid rgba(239,68,68,0.4)',
                          borderRadius:6,
                          padding:'2px 8px',
                          color:C.red,
                          fontSize:11,
                          fontWeight:700,
                          fontFamily:'monospace',
                          width:'fit-content'
                        }}>
                          {meta?.icon || '🚨'} {activeAlert?.errorCode || 'HARDWARE_FAULT'}
                        </span>
                        <span style={{color:C.muted, fontSize:11, maxWidth: 220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={activeAlert?.details || 'Machine halted in error state'}>
                          {activeAlert?.details || 'Machine halted in error state'}
                        </span>
                      </div>
                    )}
                  </div>
                </td>
                <td style={{padding:'12px 16px',color:C.muted,fontSize:12}}>{m.last_seen?ago(m.last_seen):'Never'}</td>
                <td style={{padding:'12px 16px',color:C.muted,fontSize:12}}>{m.firmware_version??'—'}</td>
                <td style={{padding:'12px 16px'}}>
                  <button
                    onClick={()=>toggle(m)}
                    style={{
                      ...btnGhost,
                      color: m.status === 'online' ? C.red : C.green,
                      borderColor: m.status === 'maintenance' ? C.green : undefined,
                      fontWeight: m.status === 'maintenance' ? 700 : undefined,
                    }}
                  >
                    {m.status === 'online' ? 'Disable' : (m.status === 'maintenance' ? 'Resolve (Set Online)' : 'Enable')}
                  </button>
                </td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

// ── Alerts & Fault Management ──────────────────────────────────
function AlertsSection({ machines, alerts, onRefresh }:{ machines:Machine[]; alerts:AlertItem[]; onRefresh:()=>void }) {
  const [resolving, setResolving] = useState<string|null>(null)
  const [expandedGuides, setExpandedGuides] = useState<Record<string, boolean>>({})

  const handleResolve = async (machine: Machine) => {
    setResolving(machine.id)
    try {
      await fetch('/api/machine-alert', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId: machine.machine_code, machineDbId: machine.id }),
      })
      onRefresh()
    } finally {
      setResolving(null)
    }
  }

  const maintenanceMachines = machines.filter(m => m.status === 'maintenance')
  const offlineMachines = machines.filter(m => m.status === 'offline')

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2 style={{color:C.cream,fontSize:22,fontWeight:700}}>Alerts & Hardware Fault Management</h2>
          <p style={{color:C.muted,fontSize:13,marginTop:4}}>Live diagnostic status from vending machine microcontrollers</p>
        </div>
        <button onClick={onRefresh} style={btnGhost}>↻ Refresh Status</button>
      </div>

      {/* Active Critical Alerts */}
      {maintenanceMachines.length > 0 ? (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{color:C.red,fontSize:13,fontWeight:700,letterSpacing:1,textTransform:'uppercase',display:'flex',alignItems:'center',gap:8}}>
            <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:C.red,boxShadow:`0 0 10px ${C.red}`}} />
            Active Machine Faults ({maintenanceMachines.length})
          </div>
          {maintenanceMachines.map(m => {
            const machineAlert = alerts.find(a => a.machineId === m.machine_code && !a.resolved)
            const meta = getErrorMetadata(machineAlert?.errorCode || 'MACHINE_IN_ERROR_STATE')
            const isExpanded = expandedGuides[m.id] ?? true

            return (
              <div key={m.id} style={{
                background:'rgba(239,68,68,0.08)',
                border:'1px solid rgba(239,68,68,0.35)',
                borderRadius:16,
                padding:'20px 24px',
                display:'flex',
                flexDirection:'column',
                gap:16,
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:16}}>
                  <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
                    <div style={{
                      fontSize:32,
                      lineHeight:1,
                      background:'rgba(239,68,68,0.2)',
                      padding:'12px',
                      borderRadius:14,
                      border:'1px solid rgba(239,68,68,0.3)'
                    }}>
                      {meta.icon}
                    </div>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{color:'#FFFFFF',fontSize:18,fontWeight:700}}>{m.machine_name}</span>
                        <span style={{fontFamily:'monospace',fontSize:12,color:C.muted,background:'rgba(255,255,255,0.06)',padding:'2px 8px',borderRadius:6}}>{m.machine_code}</span>
                        <span style={badge(C.red)}>HARDWARE HALTED</span>
                        <span style={{background:'rgba(255,255,255,0.08)',color:C.goldL,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700}}>
                          {meta.category}
                        </span>
                      </div>

                      {/* Diagnostic Fault Code Badge & Title */}
                      <div style={{display:'flex',alignItems:'center',gap:10,margin:'8px 0',flexWrap:'wrap'}}>
                        <span style={{
                          background:'rgba(239,68,68,0.25)',
                          color:C.red,
                          border:'1px solid rgba(239,68,68,0.5)',
                          borderRadius:8,
                          padding:'4px 10px',
                          fontSize:13,
                          fontWeight:800,
                          fontFamily:'monospace',
                          letterSpacing:0.5,
                        }}>
                          🚨 {meta.code}
                        </span>
                        <span style={{color:C.cream,fontSize:14,fontWeight:600}}>
                          {meta.title}
                        </span>
                      </div>

                      <p style={{color:C.muted,fontSize:13,marginTop:4,marginBottom:8}}>
                        <strong style={{color:C.cream}}>Reported Details: </strong>
                        {machineAlert?.details || meta.description}
                      </p>

                      <div style={{display:'flex',gap:16,color:C.muted,fontSize:12,flexWrap:'wrap'}}>
                        <span>📍 Location: <strong style={{color:C.cream}}>{m.location}</strong></span>
                        <span>⏱ Fault Occurred: <strong style={{color:C.cream}}>{machineAlert ? ago(machineAlert.timestamp) : (m.last_seen ? ago(m.last_seen) : 'Recently')}</strong></span>
                        <span>📟 Firmware: <strong style={{color:C.cream}}>v{m.firmware_version || '1.0.0'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div style={{display:'flex',gap:10}}>
                    <button
                      disabled={resolving === m.id}
                      onClick={() => handleResolve(m)}
                      style={{
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 10,
                        padding: '10px 18px',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
                      }}
                    >
                      {resolving === m.id ? 'Resolving...' : '✓ Mark Resolved & Set Online'}
                    </button>
                  </div>
                </div>

                {/* Technician Fix Guide Checklist */}
                <div style={{
                  background:'rgba(0,0,0,0.25)',
                  border:'1px solid rgba(255,255,255,0.06)',
                  borderRadius:12,
                  padding:'14px 18px',
                }}>
                  <div
                    onClick={() => setExpandedGuides(prev => ({ ...prev, [m.id]: !isExpanded }))}
                    style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',userSelect:'none'}}
                  >
                    <span style={{color:C.goldL,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                      🛠️ Field Technician Fix Guide for {meta.code}
                    </span>
                    <span style={{color:C.muted,fontSize:12}}>
                      {isExpanded ? '▲ Hide Guide' : '▼ Show Checklist'}
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:12}}>
                      {meta.troubleshooting.map((step, idx) => (
                        <div key={idx} style={{display:'flex',gap:10,alignItems:'flex-start',fontSize:13,color:C.cream}}>
                          <span style={{
                            background:'rgba(217,119,6,0.2)',
                            color:C.goldL,
                            borderRadius:'50%',
                            width:20,
                            height:20,
                            display:'flex',
                            alignItems:'center',
                            justifyContent:'center',
                            fontSize:11,
                            fontWeight:700,
                            flexShrink:0,
                            marginTop:1
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{lineHeight:1.4}}>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{
          background:'rgba(34,197,94,0.06)',
          border:'1px solid rgba(34,197,94,0.2)',
          borderRadius:16,
          padding:'24px',
          display:'flex',
          alignItems:'center',
          gap:16,
        }}>
          <div style={{fontSize:28}}>✅</div>
          <div>
            <p style={{color:'#FFFFFF',fontWeight:700,fontSize:16}}>All Systems Operational</p>
            <p style={{color:C.muted,fontSize:13,marginTop:2}}>No machines currently in maintenance or error state. Microcontrollers are running normally.</p>
          </div>
        </div>
      )}

      {/* Offline Machines Notification if any */}
      {offlineMachines.length > 0 && (
        <div style={{...card}}>
          <div style={{color:C.yellow,fontSize:12,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>
            Offline Machines ({offlineMachines.length})
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {offlineMachines.map(m => (
              <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                <div>
                  <span style={{color:C.cream,fontWeight:600,marginRight:8}}>{m.machine_name}</span>
                  <span style={{color:C.muted,fontSize:12}}>({m.machine_code} • {m.location})</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{color:C.muted,fontSize:12}}>{m.last_seen ? `Last seen ${ago(m.last_seen)}` : 'Never connected'}</span>
                  <span style={badge(C.yellow)}>OFFLINE</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Log History */}
      <div style={{...card,padding:0,overflowX:'auto'}}>
        <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <p style={{color:C.cream,fontSize:14,fontWeight:600}}>Hardware Alert Audit Log</p>
          <span style={{color:C.muted,fontSize:11}}>{alerts.length} event(s) recorded</span>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted,background:'rgba(255,255,255,0.02)'}}>
            {['Time','Machine ID','Error Code','Diagnostic Details','Status'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {alerts.length > 0 ? (
              alerts.map(a => (
                <tr key={a.id} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                  <td style={{padding:'11px 16px',color:C.muted,fontSize:12}}>{fmt(a.timestamp)}</td>
                  <td style={{padding:'11px 16px',color:C.cream,fontFamily:'monospace',fontSize:12}}>{a.machineId}</td>
                  <td style={{padding:'11px 16px',color:C.red,fontWeight:700,fontFamily:'monospace'}}>{a.errorCode}</td>
                  <td style={{padding:'11px 16px',color:C.muted,fontSize:12}}>{a.details || '—'}</td>
                  <td style={{padding:'11px 16px'}}>
                    <span style={badge(a.resolved ? C.green : C.red)}>
                      {a.resolved ? 'RESOLVED' : 'ACTIVE'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{padding:'24px',textAlign:'center',color:C.muted}}>
                  No hardware alerts reported yet. Normal operations.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Transactions ──────────────────────────────────────────────
function TransactionsSection() {
  const [txns,setTxns]=useState<Transaction[]>([])
  const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [status,setStatus]=useState('')
  const load=()=>{
    const p=new URLSearchParams(); if(from)p.set('from',from); if(to)p.set('to',to); if(status)p.set('status',status)
    fetch(`/api/admin/transactions?${p}`).then(r=>r.json()).then(d=>setTxns(d.transactions??[]))
  }
  useEffect(()=>{ load() },[])
  const inp = { background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px', color:C.cream, fontSize:13, fontFamily:C.font, outline:'none' }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <h2 style={{color:C.cream,fontSize:22,fontWeight:700}}>Transactions</h2>
      <div className="filter-row" style={{display:'flex',gap:10,flexWrap:'wrap' as const}}>
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inp} />
        <input type="date" value={to}   onChange={e=>setTo(e.target.value)}   style={inp} />
        <select value={status} onChange={e=>setStatus(e.target.value)} style={{...inp,cursor:'pointer'}}>
          <option value="">All Status</option><option value="paid">Paid</option><option value="failed">Failed</option>
        </select>
        <button onClick={load} style={btnGold}>Filter</button>
      </div>
      <div style={{...card,padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted}}>
            {['Time','Order ID','Product(s)','Phone','Amount','Status'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{txns.map(tx=>(
            <tr key={tx.id} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
              <td style={{padding:'11px 16px',color:C.muted,fontSize:12}}>{fmt(tx.created_at)}</td>
              <td style={{padding:'11px 16px',color:C.cream,fontFamily:'monospace',fontSize:11}}>{tx.order_id.slice(0,16)}…</td>
              <td style={{padding:'11px 16px',color:C.cream}}>{tx.products?.map(p=>p.name).join(', ')||'—'}</td>
              <td style={{padding:'11px 16px',color:C.muted}}>{tx.phone||'—'}</td>
              <td style={{padding:'11px 16px',color:C.gold,fontWeight:700}}>{rupee(tx.payment_amount)}</td>
              <td style={{padding:'11px 16px'}}><span style={badge(tx.payment_status==='paid'?C.green:C.red)}>{tx.payment_status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tokens ────────────────────────────────────────────────────
function TokensSection() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [sharingToken, setSharingToken] = useState<Token | null>(null)
  const [targetPhone, setTargetPhone] = useState('')
  const [targetEmail, setTargetEmail] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (statusF) p.set('status', statusF)
    fetch(`/api/admin/tokens?${p}`)
      .then(r => r.json())
      .then(d => setTokens(d.tokens ?? []))
  }, [search, statusF])

  useEffect(() => { load() }, [load])

  const cancel = async (id: string) => {
    if (confirm('Are you sure you want to cancel this unused token?')) {
      await fetch('/api/admin/tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: id })
      })
      load()
    }
  }

  const getRedeemUrl = (t: Token) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cupos.in'
    return `${origin}/gift/${t.order_id || t.token}`
  }

  const getWhatsAppMessage = (t: Token) => {
    const prodName = t.products?.name || 'Beverage'
    const size = t.is_half ? 'Half Cup' : 'Full Cup'
    const expires = t.expires_at ? new Date(t.expires_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'
    const url = getRedeemUrl(t)

    return `☕ *Your CupOS Drink Token is Ready!*\n\n` +
      `Drink: *${prodName}* (${size})\n` +
      `Token Code: *${t.token}*\n` +
      `Valid Until: ${expires}\n\n` +
      `📱 *How to Redeem:*\n` +
      `1. Visit any CupOS Smart Vending Machine.\n` +
      `2. Open your QR link or scan the token code directly at the camera.\n\n` +
      `🔗 *View & Redeem QR:*\n${url}\n\n` +
      `Enjoy your freshly brewed drink! ☕`
  }

  const getEmailContent = (t: Token) => {
    const prodName = t.products?.name || 'Beverage'
    const size = t.is_half ? 'Half Cup' : 'Full Cup'
    const expires = t.expires_at ? new Date(t.expires_at).toLocaleString('en-IN') : 'Never'
    const url = getRedeemUrl(t)

    const subject = `☕ Your CupOS Drink Token: ${prodName} (${t.token})`
    const body = `Hello,\n\n` +
      `Your beverage token for a freshly prepared ${prodName} (${size}) is ready to be redeemed at any CupOS vending machine.\n\n` +
      `Token Code: ${t.token}\n` +
      `Valid Until: ${expires}\n\n` +
      `To redeem your drink:\n` +
      `Open the link below to display your QR code to the machine camera, or scan the code directly:\n` +
      `${url}\n\n` +
      `Enjoy your beverage!\n` +
      `CupOS Team`

    return { subject, body }
  }

  const shareWhatsApp = (t: Token, phoneOverride?: string) => {
    const phone = (phoneOverride !== undefined ? phoneOverride : (t.phone || '')).replace(/\D/g, '')
    const fullPhone = phone.length === 10 ? `91${phone}` : phone
    const text = encodeURIComponent(getWhatsAppMessage(t))
    const waUrl = fullPhone ? `https://api.whatsapp.com/send?phone=${fullPhone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`
    window.open(waUrl, '_blank')
  }

  const shareGmail = (t: Token, emailOverride?: string) => {
    const { subject, body } = getEmailContent(t)
    const to = encodeURIComponent(emailOverride || '')
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(gmailUrl, '_blank')
  }

  const copyMessage = async (t: Token) => {
    await navigator.clipboard.writeText(getWhatsAppMessage(t))
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const openShareModal = (t: Token) => {
    setSharingToken(t)
    setTargetPhone(t.phone || '')
    setTargetEmail('')
  }

  const statusColor: Record<string, string> = { UNUSED: C.gold, REDEEMED: C.green, EXPIRED: C.muted, CANCELLED: C.red }
  const inp = { background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', color: C.cream, fontSize: 13, fontFamily: C.font, outline: 'none' }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{color:C.cream,fontSize:22,fontWeight:700}}>Token Management</h2>
          <p style={{color:C.muted,fontSize:13,marginTop:4}}>Inspect QR tokens, cancel expired items, and share unused tokens via WhatsApp or Gmail</p>
        </div>
        <button onClick={load} style={btnGhost}>↻ Refresh</button>
      </div>

      <div className="filter-row" style={{display:'flex',gap:10,flexWrap:'wrap' as const}}>
        <input placeholder="Search token (CPOS-…)" value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,width:220}} />
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{...inp,cursor:'pointer'}}>
          <option value="">All Status</option>
          {['UNUSED','REDEEMED','EXPIRED','CANCELLED'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} style={btnGold}>Search</button>
      </div>

      <div style={{...card,padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted,background:'rgba(255,255,255,0.02)'}}>
            {['Token & QR','Product','Status','Customer Phone','Created','Redeemed','Actions'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{tokens.map(t=>(
            <tr key={t.id} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
              <td style={{padding:'11px 16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{color:C.cream,fontFamily:'monospace',fontSize:12,fontWeight:700}}>{t.token}</span>
                  {t.status === 'UNUSED' && (
                    <button
                      onClick={() => copyMessage(t)}
                      title="Copy Token Share Text"
                      style={{background:'none',border:'none',color:copiedId === t.id ? C.green : C.muted,cursor:'pointer',fontSize:11,padding:'2px 4px'}}
                    >
                      {copiedId === t.id ? '✓' : '📋'}
                    </button>
                  )}
                </div>
              </td>
              <td style={{padding:'11px 16px',color:C.cream}}>
                <div>{(t.products as {name:string}|null)?.name||'—'}</div>
                <div style={{color:C.muted,fontSize:11}}>{t.is_half ? 'Half Cup' : 'Full Cup'}</div>
              </td>
              <td style={{padding:'11px 16px'}}><span style={badge(statusColor[t.status]||C.muted)}>{t.status}</span></td>
              <td style={{padding:'11px 16px',color:C.muted}}>{t.phone||'—'}</td>
              <td style={{padding:'11px 16px',color:C.muted,fontSize:12}}>
                <div>{fmt(t.created_at)}</div>
                <div style={{color:'rgba(255,255,255,0.3)',fontSize:11}}>{ago(t.created_at)}</div>
              </td>
              <td style={{padding:'11px 16px',color:C.muted,fontSize:12}}>{t.redeemed_at?fmt(t.redeemed_at):'—'}</td>
              <td style={{padding:'11px 16px'}}>
                {t.status === 'UNUSED' ? (
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    <button
                      onClick={() => openShareModal(t)}
                      style={{
                        background:'rgba(200,146,42,0.15)',
                        color:C.goldL,
                        border:`1px solid ${C.border}`,
                        borderRadius:6,
                        padding:'5px 10px',
                        fontSize:11,
                        fontWeight:700,
                        cursor:'pointer',
                        display:'inline-flex',
                        alignItems:'center',
                        gap:4
                      }}
                    >
                      📤 Share
                    </button>
                    <button
                      onClick={() => shareWhatsApp(t)}
                      title="Quick Share on WhatsApp"
                      style={{
                        background:'#25D366',
                        color:'#FFFFFF',
                        border:'none',
                        borderRadius:6,
                        padding:'5px 8px',
                        fontSize:11,
                        fontWeight:700,
                        cursor:'pointer',
                        display:'inline-flex',
                        alignItems:'center',
                        gap:3
                      }}
                    >
                      <span>💬</span> WhatsApp
                    </button>
                    <button
                      onClick={() => shareGmail(t)}
                      title="Quick Share on Gmail"
                      style={{
                        background:'rgba(239,68,68,0.15)',
                        color:'#ef4444',
                        border:'1px solid rgba(239,68,68,0.3)',
                        borderRadius:6,
                        padding:'5px 8px',
                        fontSize:11,
                        fontWeight:700,
                        cursor:'pointer',
                        display:'inline-flex',
                        alignItems:'center',
                        gap:3
                      }}
                    >
                      <span>✉️</span> Gmail
                    </button>
                    <button
                      onClick={() => cancel(t.id)}
                      title="Cancel this token"
                      style={{...btnGhost,color:C.red,fontSize:11,padding:'5px 8px'}}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span style={{color:C.muted,fontSize:12}}>—</span>
                )}
              </td>
            </tr>
          ))}
          {tokens.length === 0 && (
            <tr><td colSpan={7} style={{padding:'24px',textAlign:'center',color:C.muted}}>No tokens found.</td></tr>
          )}
          </tbody>
        </table>
      </div>

      {/* Share Token Modal with WhatsApp & Gmail */}
      {sharingToken && (
        <div style={{
          position:'fixed',top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',
          zIndex:1000,backdropFilter:'blur(5px)',padding:20
        }}>
          <div style={{
            background:'#0D0A08',
            border:`1px solid ${C.gold}`,
            borderRadius:20,
            padding:'28px 24px',
            maxWidth:480,
            width:'100%',
            display:'flex',
            flexDirection:'column',
            gap:16,
            boxShadow:'0 20px 40px rgba(0,0,0,0.8)',
            maxHeight:'90vh',
            overflowY:'auto'
          }}>
            {/* Modal Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'1px solid rgba(255,255,255,0.06)',paddingBottom:12}}>
              <div>
                <h3 style={{color:C.cream,fontSize:20,fontWeight:700}}>Share Unused Token</h3>
                <p style={{color:C.muted,fontSize:12,marginTop:2}}>Send to customer via WhatsApp, Gmail, or copy direct QR code</p>
              </div>
              <button
                onClick={() => setSharingToken(null)}
                style={{background:'none',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}
              >
                ✕
              </button>
            </div>

            {/* Token Info & QR Card */}
            <div style={{display:'flex',gap:16,alignItems:'center',background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:14,padding:16}}>
              <div style={{flexShrink:0}}>
                <SafeQRCode value={sharingToken.token} size={110} />
              </div>
              <div>
                <span style={{
                  background:'rgba(200,146,42,0.2)',
                  color:C.goldL,
                  padding:'3px 8px',
                  borderRadius:6,
                  fontFamily:'monospace',
                  fontWeight:800,
                  fontSize:13
                }}>
                  {sharingToken.token}
                </span>
                <p style={{color:C.cream,fontSize:15,fontWeight:700,marginTop:6}}>
                  {sharingToken.products?.name || 'Beverage'}
                </p>
                <p style={{color:C.muted,fontSize:12}}>
                  {sharingToken.is_half ? 'Half Cup Option' : 'Full Cup Standard'}
                </p>
                <p style={{color:'rgba(255,255,255,0.4)',fontSize:11,marginTop:4}}>
                  Valid until: {sharingToken.expires_at ? new Date(sharingToken.expires_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : 'Never'}
                </p>
              </div>
            </div>

            {/* Recipient Inputs */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1,display:'block',marginBottom:4}}>
                  Recipient Phone (for WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210 (10 digits)"
                  value={targetPhone}
                  onChange={e => setTargetPhone(e.target.value)}
                  style={{
                    width:'100%',
                    background:'rgba(255,255,255,0.06)',
                    border:`1px solid ${C.border}`,
                    borderRadius:8,
                    padding:'9px 12px',
                    color:C.cream,
                    fontSize:13,
                    fontFamily:C.font,
                    outline:'none'
                  }}
                />
              </div>

              <div>
                <label style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1,display:'block',marginBottom:4}}>
                  Recipient Email (for Gmail)
                </label>
                <input
                  type="email"
                  placeholder="e.g. customer@gmail.com"
                  value={targetEmail}
                  onChange={e => setTargetEmail(e.target.value)}
                  style={{
                    width:'100%',
                    background:'rgba(255,255,255,0.06)',
                    border:`1px solid ${C.border}`,
                    borderRadius:8,
                    padding:'9px 12px',
                    color:C.cream,
                    fontSize:13,
                    fontFamily:C.font,
                    outline:'none'
                  }}
                />
              </div>
            </div>

            {/* Send Actions */}
            <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:6}}>
              <button
                onClick={() => shareWhatsApp(sharingToken, targetPhone)}
                style={{
                  background: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37,211,102,0.3)'
                }}
              >
                <span>💬</span> Share via WhatsApp
              </button>

              <button
                onClick={() => shareGmail(sharingToken, targetEmail)}
                style={{
                  background: 'linear-gradient(135deg, #EA4335, #C5221F)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(234,67,53,0.3)'
                }}
              >
                <span>✉️</span> Share via Gmail
              </button>

              <div style={{display:'flex',gap:10}}>
                <button
                  onClick={() => copyMessage(sharingToken)}
                  style={{
                    ...btnGhost,
                    flex:1,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    gap:6
                  }}
                >
                  <span>📋</span> {copiedId === sharingToken.id ? '✓ Copied Message!' : 'Copy Share Message'}
                </button>
                <button
                  onClick={() => setSharingToken(null)}
                  style={{...btnGhost,padding:'10px 18px'}}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Products ──────────────────────────────────────────────────
// ── Products ──────────────────────────────────────────────────
function ProductsSection() {
  const [products, setProducts] = useState<Product[]>([])
  const [editId, setEditId] = useState<string|null>(null)
  const [formData, setFormData] = useState<Partial<Product>>({})
  
  const load = useCallback(() => { fetch('/api/admin/products').then(r=>r.json()).then(d=>setProducts(d.products??[])) }, [])
  useEffect(() => { load() }, [load])

  const handleSave = async (id?: string) => {
    if (id) {
      await fetch('/api/admin/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...formData }) })
    } else {
      await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
    }
    setEditId(null); setFormData({}); load()
  }

  const inp = { background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px', color:C.cream, fontSize:13, fontFamily:C.font, outline:'none', width:'100%' }
  
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2 style={{color:C.cream,fontSize:22,fontWeight:700}}>Product Management</h2>
        <button onClick={()=>{setEditId('new'); setFormData({ name:'', description:'', price:2000, active:true, relay_id:0, dispense_time_ms:300, allow_half:false, half_price:1000 })}} style={btnGold}>+ New Product</button>
      </div>

      <div style={{...card,padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted}}>
            {['Name & Desc', 'Price', 'Relay Config', 'Modifiers', 'Status', 'Action'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {editId === 'new' && (
              <tr style={{borderTop:'1px solid rgba(255,255,255,0.04)', background:'rgba(255,255,255,0.02)'}}>
                <td style={{padding:'11px 16px', display:'flex', flexDirection:'column', gap:6}}>
                  <input placeholder="Name" value={formData.name||''} onChange={e=>setFormData({...formData, name:e.target.value})} style={inp} />
                  <input placeholder="Description" value={formData.description||''} onChange={e=>setFormData({...formData, description:e.target.value})} style={inp} />
                </td>
                <td style={{padding:'11px 16px'}}><input type="number" placeholder="Paise" value={formData.price||0} onChange={e=>setFormData({...formData, price:parseInt(e.target.value)})} style={{...inp, width:80}} /></td>
                <td style={{padding:'11px 16px', display:'flex', flexDirection:'column', gap:6}}>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}><span style={{color:C.muted,fontSize:11}}>Relay</span><input type="number" value={formData.relay_id||0} onChange={e=>setFormData({...formData, relay_id:parseInt(e.target.value)})} style={{...inp, width:50, padding:4}} /></div>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}><span style={{color:C.muted,fontSize:11}}>ms</span><input type="number" value={formData.dispense_time_ms||300} onChange={e=>setFormData({...formData, dispense_time_ms:parseInt(e.target.value)})} style={{...inp, width:70, padding:4}} /></div>
                </td>
                <td style={{padding:'11px 16px'}}>
                  <label style={{display:'flex', alignItems:'center', gap:6, color:C.cream, fontSize:12}}><input type="checkbox" checked={formData.allow_half||false} onChange={e=>setFormData({...formData, allow_half:e.target.checked})} /> Allow Half-Cup</label>
                  {formData.allow_half && (
                    <div style={{display:'flex', gap:6, alignItems:'center', marginTop:6}}>
                      <span style={{color:C.muted,fontSize:11}}>Half Price:</span>
                      <input type="number" placeholder="Paise" value={formData.half_price||0} onChange={e=>setFormData({...formData, half_price:parseInt(e.target.value)})} style={{...inp, width:60, padding:4}} />
                    </div>
                  )}
                </td>
                <td style={{padding:'11px 16px'}}><label style={{display:'flex', alignItems:'center', gap:6, color:C.cream, fontSize:12}}><input type="checkbox" checked={formData.active||false} onChange={e=>setFormData({...formData, active:e.target.checked})} /> Active</label></td>
                <td style={{padding:'11px 16px', display:'flex', gap:6}}>
                  <button onClick={()=>handleSave()} style={{...btnGold, padding:'6px 12px'}}>Save</button>
                  <button onClick={()=>setEditId(null)} style={{...btnGhost, padding:'6px 12px'}}>Cancel</button>
                </td>
              </tr>
            )}
            
            {products.map(p=>(
              editId === p.id ? (
                <tr key={p.id} style={{borderTop:'1px solid rgba(255,255,255,0.04)', background:'rgba(255,255,255,0.02)'}}>
                  <td style={{padding:'11px 16px', display:'flex', flexDirection:'column', gap:6}}>
                    <input value={formData.name||''} onChange={e=>setFormData({...formData, name:e.target.value})} style={inp} />
                    <input value={formData.description||''} onChange={e=>setFormData({...formData, description:e.target.value})} style={inp} />
                  </td>
                  <td style={{padding:'11px 16px'}}><input type="number" value={formData.price||0} onChange={e=>setFormData({...formData, price:parseInt(e.target.value)})} style={{...inp, width:80}} /></td>
                  <td style={{padding:'11px 16px', display:'flex', flexDirection:'column', gap:6}}>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}><span style={{color:C.muted,fontSize:11}}>Relay</span><input type="number" value={formData.relay_id||0} onChange={e=>setFormData({...formData, relay_id:parseInt(e.target.value)})} style={{...inp, width:50, padding:4}} /></div>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}><span style={{color:C.muted,fontSize:11}}>ms</span><input type="number" value={formData.dispense_time_ms||300} onChange={e=>setFormData({...formData, dispense_time_ms:parseInt(e.target.value)})} style={{...inp, width:70, padding:4}} /></div>
                  </td>
                  <td style={{padding:'11px 16px'}}>
                    <label style={{display:'flex', alignItems:'center', gap:6, color:C.cream, fontSize:12}}><input type="checkbox" checked={formData.allow_half||false} onChange={e=>setFormData({...formData, allow_half:e.target.checked})} /> Allow Half-Cup</label>
                    {formData.allow_half && (
                      <div style={{display:'flex', gap:6, alignItems:'center', marginTop:6}}>
                        <span style={{color:C.muted,fontSize:11}}>Half Price:</span>
                        <input type="number" placeholder="Paise" value={formData.half_price||0} onChange={e=>setFormData({...formData, half_price:parseInt(e.target.value)})} style={{...inp, width:60, padding:4}} />
                      </div>
                    )}
                  </td>
                  <td style={{padding:'11px 16px'}}><label style={{display:'flex', alignItems:'center', gap:6, color:C.cream, fontSize:12}}><input type="checkbox" checked={formData.active||false} onChange={e=>setFormData({...formData, active:e.target.checked})} /> Active</label></td>
                  <td style={{padding:'11px 16px', display:'flex', gap:6}}>
                    <button onClick={()=>handleSave(p.id)} style={{...btnGold, padding:'6px 12px'}}>Save</button>
                    <button onClick={()=>setEditId(null)} style={{...btnGhost, padding:'6px 12px'}}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                  <td style={{padding:'11px 16px'}}>
                    <div style={{color:C.cream, fontWeight:600}}>{p.name}</div>
                    <div style={{color:C.muted, fontSize:12, marginTop:2}}>{p.description}</div>
                  </td>
                  <td style={{padding:'11px 16px',color:C.gold}}>{rupee(p.price)}</td>
                  <td style={{padding:'11px 16px',color:C.muted,fontSize:12}}>
                    Relay {p.relay_id} <br/> {p.dispense_time_ms}ms
                  </td>
                  <td style={{padding:'11px 16px'}}>
                    {p.allow_half && <span style={badge('#3b82f6')}>Half: ₹{Math.floor((p.half_price||0)/100)}</span>}
                  </td>
                  <td style={{padding:'11px 16px'}}><span style={badge(p.active?C.green:C.red)}>{p.active?'Active':'Hidden'}</span></td>
                  <td style={{padding:'11px 16px'}}>
                    <button onClick={()=>{setEditId(p.id ?? null); setFormData(p)}} style={{...btnGhost, fontSize:11}}>Edit</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Customers ──────────────────────────────────────────────────
function CustomersSection() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & Search State
  const [search, setSearch] = useState('')
  const [walletFilter, setWalletFilter] = useState<'all' | 'has_balance' | 'zero_balance' | 'high_balance'>('all')
  const [spendFilter, setSpendFilter] = useState<'all' | 'has_spent' | 'high_spent' | 'zero_spent'>('all')
  const [orderFilter, setOrderFilter] = useState<'all' | 'repeat' | 'has_orders' | 'zero_orders'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [sortBy, setSortBy] = useState<'joined_desc' | 'joined_asc' | 'wallet_desc' | 'spent_desc' | 'orders_desc' | 'name_asc'>('joined_desc')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/customers?_t=${Date.now()}`)
      .then(r => r.json())
      .then(d => {
        setCustomers(d.customers ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreditWallet = async (userId: string, name: string) => {
    const input = prompt(`Enter amount in ₹ to credit to ${name}'s wallet:\n(e.g. 100 for ₹100)`)
    if (!input) return
    const amountInRupees = parseInt(input)
    if (isNaN(amountInRupees) || amountInRupees <= 0) {
      alert('Invalid amount.')
      return
    }
    const amountInPaise = amountInRupees * 100
    if (confirm(`Are you sure you want to credit ₹${amountInRupees} to ${name}?`)) {
      try {
        const res = await fetch('/api/admin/wallet-credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount: amountInPaise })
        })
        const data = await res.json()
        if (data.success) {
          alert(`Successfully credited ₹${amountInRupees}!`)
          load()
          if (selectedCustomer && selectedCustomer.id === userId) {
            setSelectedCustomer(prev => prev ? { ...prev, wallet_balance: prev.wallet_balance + amountInPaise } : null)
          }
        } else {
          alert('Failed to credit wallet: ' + data.error)
        }
      } catch (err) {
        alert('Error crediting wallet.')
      }
    }
  }

  // Filtered and sorted customer list
  const filteredCustomers = useMemo(() => {
    let result = [...customers]

    // 1. Text search
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.id.toLowerCase().includes(q)
      )
    }

    // 2. Wallet balance filter
    if (walletFilter === 'has_balance') {
      result = result.filter(c => c.wallet_balance > 0)
    } else if (walletFilter === 'zero_balance') {
      result = result.filter(c => c.wallet_balance === 0)
    } else if (walletFilter === 'high_balance') {
      result = result.filter(c => c.wallet_balance >= 10000) // ₹100+
    }

    // 3. Spend filter
    if (spendFilter === 'has_spent') {
      result = result.filter(c => c.total_spent > 0)
    } else if (spendFilter === 'high_spent') {
      result = result.filter(c => c.total_spent >= 50000) // ₹500+
    } else if (spendFilter === 'zero_spent') {
      result = result.filter(c => c.total_spent === 0)
    }

    // 4. Orders filter
    if (orderFilter === 'repeat') {
      result = result.filter(c => (c.order_count || 0) >= 2)
    } else if (orderFilter === 'has_orders') {
      result = result.filter(c => (c.order_count || 0) >= 1)
    } else if (orderFilter === 'zero_orders') {
      result = result.filter(c => (c.order_count || 0) === 0)
    }

    // 5. Date filter
    if (dateFilter !== 'all') {
      const now = Date.now()
      result = result.filter(c => {
        const joined = new Date(c.created_at).getTime()
        const diffMs = now - joined
        if (dateFilter === 'today') return diffMs <= 24 * 60 * 60 * 1000
        if (dateFilter === 'week') return diffMs <= 7 * 24 * 60 * 60 * 1000
        if (dateFilter === 'month') return diffMs <= 30 * 24 * 60 * 60 * 1000
        return true
      })
    }

    // 6. Sort
    result.sort((a, b) => {
      if (sortBy === 'joined_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'wallet_desc') return b.wallet_balance - a.wallet_balance
      if (sortBy === 'spent_desc') return b.total_spent - a.total_spent
      if (sortBy === 'orders_desc') return (b.order_count || 0) - (a.order_count || 0)
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
      // default: joined_desc
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return result
  }, [customers, search, walletFilter, spendFilter, orderFilter, dateFilter, sortBy])

  // Summary statistics for customer fleet
  const statsSummary = useMemo(() => {
    const totalCustomers = customers.length
    const withBalance = customers.filter(c => c.wallet_balance > 0).length
    const totalWalletFloat = customers.reduce((sum, c) => sum + c.wallet_balance, 0)
    const totalLifetimeSpend = customers.reduce((sum, c) => sum + c.total_spent, 0)
    return { totalCustomers, withBalance, totalWalletFloat, totalLifetimeSpend }
  }, [customers])

  const hasActiveFilters = Boolean(
    search || walletFilter !== 'all' || spendFilter !== 'all' || orderFilter !== 'all' || dateFilter !== 'all' || sortBy !== 'joined_desc'
  )

  const clearFilters = () => {
    setSearch('')
    setWalletFilter('all')
    setSpendFilter('all')
    setOrderFilter('all')
    setDateFilter('all')
    setSortBy('joined_desc')
  }

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Joined Date', 'Wallet Balance (Rs)', 'Direct Spent (Rs)', 'Wallet Spent (Rs)', 'Total Spent (Rs)', 'Orders Count', 'Last Order']
    const rows = filteredCustomers.map(c => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.phone || '',
      c.email || '',
      c.created_at,
      (c.wallet_balance / 100).toFixed(2),
      ((c.direct_spent || 0) / 100).toFixed(2),
      ((c.wallet_spent || 0) / 100).toFixed(2),
      (c.total_spent / 100).toFixed(2),
      c.order_count || 0,
      c.last_order_at || 'Never'
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `cupos_customers_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const selStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '8px 12px',
    color: C.cream,
    fontSize: 12,
    fontFamily: C.font,
    outline: 'none',
    cursor: 'pointer',
  }

  if (loading && customers.length === 0) return <p style={{color:C.muted}}>Loading customers...</p>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {/* Header & Export Action */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{color:C.cream,fontSize:22,fontWeight:700}}>Customer Management</h2>
          <p style={{color:C.muted,fontSize:13,marginTop:4}}>View profiles, search by parameters, credit wallets, and track order histories</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={exportCSV} style={{...btnGhost, display:'flex', alignItems:'center', gap:6}}>
            <span>📥</span> Export CSV ({filteredCustomers.length})
          </button>
          <button onClick={load} style={btnGhost}>↻ Refresh</button>
        </div>
      </div>

      {/* Overview Stat Chips */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
        <div style={{...card,padding:'14px 18px'}}>
          <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Total Registered</p>
          <p style={{color:C.cream,fontSize:22,fontWeight:700,marginTop:4}}>{statsSummary.totalCustomers}</p>
          <p style={{color:C.muted,fontSize:11,marginTop:2}}>{statsSummary.withBalance} with wallet credit</p>
        </div>
        <div style={{...card,padding:'14px 18px'}}>
          <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Total Wallet Float</p>
          <p style={{color:C.goldL,fontSize:22,fontWeight:700,marginTop:4}}>{rupee(statsSummary.totalWalletFloat)}</p>
          <p style={{color:C.muted,fontSize:11,marginTop:2}}>Active balance held by customers</p>
        </div>
        <div style={{...card,padding:'14px 18px'}}>
          <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Customer Lifetime Spend</p>
          <p style={{color:C.green,fontSize:22,fontWeight:700,marginTop:4}}>{rupee(statsSummary.totalLifetimeSpend)}</p>
          <p style={{color:C.muted,fontSize:11,marginTop:2}}>Total drink purchases made</p>
        </div>
        <div style={{...card,padding:'14px 18px'}}>
          <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Matching Filter</p>
          <p style={{color:C.gold,fontSize:22,fontWeight:700,marginTop:4}}>{filteredCustomers.length}</p>
          <p style={{color:C.muted,fontSize:11,marginTop:2}}>of {customers.length} total customers</p>
        </div>
      </div>

      {/* Search & Multi-Parameter Filter Controls */}
      <div style={{...card,display:'flex',flexDirection:'column',gap:14,padding:'18px 20px'}}>
        {/* Top Search Input */}
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{position:'relative',flex:1,minWidth:240}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:C.muted,fontSize:14}}>🔍</span>
            <input
              type="text"
              placeholder="Search by name, phone, email, or user ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width:'100%',
                background:'rgba(255,255,255,0.06)',
                border:`1px solid ${C.border}`,
                borderRadius:8,
                padding:'10px 14px 10px 36px',
                color:C.cream,
                fontSize:13,
                fontFamily:C.font,
                outline:'none'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:14}}
              >
                ✕
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{...btnGhost,color:C.red,borderColor:'rgba(239,68,68,0.3)',padding:'9px 14px'}}>
              Reset All Filters
            </button>
          )}
        </div>

        {/* Parameter Filters Row */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          {/* Wallet Balance Filter */}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Wallet Balance</label>
            <select value={walletFilter} onChange={e => setWalletFilter(e.target.value as any)} style={selStyle}>
              <option value="all" style={{background:'#0D0A08',color:C.cream}}>All Wallets</option>
              <option value="has_balance" style={{background:'#0D0A08',color:C.cream}}>Has Balance (&gt; ₹0)</option>
              <option value="high_balance" style={{background:'#0D0A08',color:C.cream}}>High Balance (≥ ₹100)</option>
              <option value="zero_balance" style={{background:'#0D0A08',color:C.cream}}>Zero Balance (₹0)</option>
            </select>
          </div>

          {/* Spending Filter */}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Total Spending</label>
            <select value={spendFilter} onChange={e => setSpendFilter(e.target.value as any)} style={selStyle}>
              <option value="all" style={{background:'#0D0A08',color:C.cream}}>All Spenders</option>
              <option value="has_spent" style={{background:'#0D0A08',color:C.cream}}>Paying Customers (&gt; ₹0)</option>
              <option value="high_spent" style={{background:'#0D0A08',color:C.cream}}>VIP Spenders (≥ ₹500)</option>
              <option value="zero_spent" style={{background:'#0D0A08',color:C.cream}}>Zero Spend (₹0)</option>
            </select>
          </div>

          {/* Orders Filter */}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Orders Count</label>
            <select value={orderFilter} onChange={e => setOrderFilter(e.target.value as any)} style={selStyle}>
              <option value="all" style={{background:'#0D0A08',color:C.cream}}>All Orders</option>
              <option value="repeat" style={{background:'#0D0A08',color:C.cream}}>Repeat Buyers (2+ Orders)</option>
              <option value="has_orders" style={{background:'#0D0A08',color:C.cream}}>At Least 1 Order</option>
              <option value="zero_orders" style={{background:'#0D0A08',color:C.cream}}>0 Orders (Inactive)</option>
            </select>
          </div>

          {/* Registration Date Filter */}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Joined Period</label>
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} style={selStyle}>
              <option value="all" style={{background:'#0D0A08',color:C.cream}}>All Time</option>
              <option value="today" style={{background:'#0D0A08',color:C.cream}}>Today</option>
              <option value="week" style={{background:'#0D0A08',color:C.cream}}>Last 7 Days</option>
              <option value="month" style={{background:'#0D0A08',color:C.cream}}>Last 30 Days</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Sort Order</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={selStyle}>
              <option value="joined_desc" style={{background:'#0D0A08',color:C.cream}}>Newest Registered</option>
              <option value="joined_asc" style={{background:'#0D0A08',color:C.cream}}>Oldest Registered</option>
              <option value="wallet_desc" style={{background:'#0D0A08',color:C.cream}}>Highest Wallet Balance</option>
              <option value="spent_desc" style={{background:'#0D0A08',color:C.cream}}>Highest Total Spent</option>
              <option value="orders_desc" style={{background:'#0D0A08',color:C.cream}}>Most Orders Placed</option>
              <option value="name_asc" style={{background:'#0D0A08',color:C.cream}}>Name (A to Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div style={{...card,padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted,background:'rgba(255,255,255,0.02)'}}>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Customer Profile</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Joined</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Wallet Balance</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Total Spent</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Orders Placed</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Actions</th>
          </tr></thead>
          <tbody>
            {filteredCustomers.map(c => {
              const initials = (c.name || 'CU').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
              return (
                <tr key={c.id} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                  {/* Profile */}
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{
                        width:36,
                        height:36,
                        borderRadius:'50%',
                        background:'linear-gradient(135deg, rgba(200,146,42,0.3), rgba(229,169,60,0.1))',
                        border:`1px solid ${C.border}`,
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        color:C.goldL,
                        fontWeight:700,
                        fontSize:12,
                        flexShrink:0
                      }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{color:C.cream, fontWeight:600, fontSize:14}}>{c.name}</div>
                        <div style={{color:C.muted, fontSize:12, marginTop:2, display:'flex', gap:8, flexWrap:'wrap'}}>
                          {c.phone && <span>📞 {c.phone}</span>}
                          {c.email && <span>✉️ {c.email}</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Joined Date */}
                  <td style={{padding:'12px 16px',color:C.muted,fontSize:12}}>
                    <div>{fmt(c.created_at)}</div>
                    <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,marginTop:2}}>{ago(c.created_at)}</div>
                  </td>

                  {/* Wallet Balance */}
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{
                        color: c.wallet_balance > 0 ? C.goldL : C.muted,
                        fontWeight: c.wallet_balance > 0 ? 800 : 500,
                        fontSize: 14,
                        fontFamily: 'monospace'
                      }}>
                        {rupee(c.wallet_balance)}
                      </span>
                      {c.wallet_balance > 0 && (
                        <span style={{width:6,height:6,borderRadius:'50%',background:C.green,boxShadow:`0 0 6px ${C.green}`}} />
                      )}
                    </div>
                  </td>

                  {/* Total Spent */}
                  <td style={{padding:'12px 16px'}}>
                    <div style={{color: c.total_spent > 0 ? C.cream : C.muted, fontWeight:600, fontSize:14}}>
                      {rupee(c.total_spent)}
                    </div>
                    {c.total_spent > 0 && (
                      <div style={{color:C.muted, fontSize:11, marginTop:2}}>
                        Direct: {rupee(c.direct_spent || 0)} • Wallet: {rupee(c.wallet_spent || 0)}
                      </div>
                    )}
                  </td>

                  {/* Orders */}
                  <td style={{padding:'12px 16px'}}>
                    <div>
                      <span style={{
                        background: (c.order_count || 0) > 0 ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                        color: (c.order_count || 0) > 0 ? '#38bdf8' : C.muted,
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700
                      }}>
                        {(c.order_count || 0)} order{(c.order_count || 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                    {c.last_order_at && (
                      <div style={{color:C.muted, fontSize:11, marginTop:4}}>
                        Last: {ago(c.last_order_at)}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex', gap:8, alignItems:'center'}}>
                      <button
                        onClick={() => handleCreditWallet(c.id, c.name)}
                        style={{...btnGold, fontSize:11, padding:'6px 12px'}}
                      >
                        + Credit Wallet
                      </button>
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        style={{...btnGhost, fontSize:11, padding:'6px 12px'}}
                      >
                        View Orders
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} style={{padding:'40px 20px',textAlign:'center',color:C.muted}}>
                  <p style={{fontSize:24,marginBottom:6}}>🔍</p>
                  <p style={{color:C.cream,fontWeight:600}}>No customers match the current search or filters.</p>
                  <button onClick={clearFilters} style={{...btnGold,marginTop:12,fontSize:12}}>
                    Clear Filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Orders History Modal */}
      {selectedCustomer && (
        <div style={{
          position:'fixed',top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',
          zIndex:1000,backdropFilter:'blur(5px)',padding:20
        }}>
          <div style={{
            background:'#0D0A08',
            border:`1px solid ${C.gold}`,
            borderRadius:20,
            padding:'28px 24px',
            maxWidth:560,
            width:'100%',
            display:'flex',
            flexDirection:'column',
            gap:18,
            boxShadow:'0 20px 40px rgba(0,0,0,0.8)',
            maxHeight:'90vh',
            overflowY:'auto'
          }}>
            {/* Modal Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'1px solid rgba(255,255,255,0.06)',paddingBottom:16}}>
              <div>
                <h3 style={{color:C.cream,fontSize:20,fontWeight:700}}>{selectedCustomer.name}</h3>
                <div style={{color:C.muted,fontSize:12,marginTop:4,display:'flex',gap:10,flexWrap:'wrap'}}>
                  {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                  {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                  <span>📅 Joined {fmt(selectedCustomer.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{background:'none',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}
              >
                ✕
              </button>
            </div>

            {/* Financial Overview Chips */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              <div style={{...card,padding:'10px 12px',textAlign:'center'}}>
                <span style={{color:C.muted,fontSize:10,textTransform:'uppercase'}}>Wallet Balance</span>
                <p style={{color:C.goldL,fontSize:16,fontWeight:800,marginTop:2}}>{rupee(selectedCustomer.wallet_balance)}</p>
              </div>
              <div style={{...card,padding:'10px 12px',textAlign:'center'}}>
                <span style={{color:C.muted,fontSize:10,textTransform:'uppercase'}}>Total Spent</span>
                <p style={{color:C.cream,fontSize:16,fontWeight:800,marginTop:2}}>{rupee(selectedCustomer.total_spent)}</p>
              </div>
              <div style={{...card,padding:'10px 12px',textAlign:'center'}}>
                <span style={{color:C.muted,fontSize:10,textTransform:'uppercase'}}>Total Orders</span>
                <p style={{color:'#38bdf8',fontSize:16,fontWeight:800,marginTop:2}}>{selectedCustomer.order_count || 0}</p>
              </div>
            </div>

            {/* Order History */}
            <div>
              <p style={{color:C.cream,fontSize:13,fontWeight:700,marginBottom:10}}>Recent Orders & Redemptions</p>
              {selectedCustomer.recent_orders && selectedCustomer.recent_orders.length > 0 ? (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {selectedCustomer.recent_orders.map(o => (
                    <div key={o.id} style={{
                      background:'rgba(255,255,255,0.03)',
                      border:'1px solid rgba(255,255,255,0.06)',
                      borderRadius:10,
                      padding:'10px 14px',
                      display:'flex',
                      justifyContent:'space-between',
                      alignItems:'center'
                    }}>
                      <div>
                        <div style={{color:C.cream,fontSize:12,fontFamily:'monospace',fontWeight:600}}>{o.order_id}</div>
                        <div style={{color:C.muted,fontSize:11,marginTop:2}}>{fmt(o.created_at)}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{color:C.goldL,fontWeight:700,fontSize:13}}>{rupee(o.payment_amount)}</div>
                        <span style={{
                          fontSize:10,
                          fontWeight:700,
                          color: o.payment_id === 'wallet' ? '#c084fc' : C.green
                        }}>
                          {o.payment_id === 'wallet' ? '👛 Wallet' : '💳 Gateway'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{color:C.muted,fontSize:12,textAlign:'center',padding:'16px 0'}}>No past orders recorded for this customer.</p>
              )}
            </div>

            {/* Actions */}
            <div style={{display:'flex',gap:10,marginTop:8}}>
              <button
                onClick={() => handleCreditWallet(selectedCustomer.id, selectedCustomer.name)}
                style={{...btnGold,flex:1}}
              >
                + Credit Customer's Wallet
              </button>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{...btnGhost,padding:'10px 18px'}}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Admin Page ───────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState('dashboard')
  const [ready, setReady] = useState(false)
  const [denied, setDenied] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [machines, setMachines] = useState<Machine[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Ensure full-width container for admin console across desktop and phone
  useEffect(() => {
    document.body.classList.add('admin-mode')
    return () => document.body.classList.remove('admin-mode')
  }, [])

  const loadMachinesAndAlerts = useCallback(() => {
    fetch(`/api/admin/machines?_t=${Date.now()}`)
      .then(r => r.json())
      .then(d => setMachines(d.machines ?? []))
      .catch(console.error)

    fetch(`/api/machine-alert?_t=${Date.now()}`)
      .then(r => r.json())
      .then(d => setAlerts(d.alerts ?? []))
      .catch(console.error)
  }, [])

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      const user = data.session?.user
      const allowed = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ''

      // Wildcard = dev mode, anyone (including guests) can access
      if (allowed === '*') {
        setAdminEmail(user?.email || user?.phone || 'Dev Admin')
        setReady(true)
        return
      }

      // No session and not wildcard → redirect to login
      if (!user) { router.push('/'); return }

      // Check specific email or phone against comma-separated list
      const allowedList = allowed.split(',').map(s => s.trim().toLowerCase())
      
      const userEmail = user.email?.trim().toLowerCase()
      const userPhone = user.phone?.trim()

      const hasAccess = 
        (userEmail && allowedList.includes(userEmail)) || 
        (userPhone && allowedList.includes(userPhone))

      if (hasAccess) {
        setAdminEmail(user.email || user.phone || 'Admin')
        setReady(true)
      } else {
        setDenied(true)
      }
    })
  },[router])

  // Polling for machine status & error alerts every 15 seconds
  useEffect(() => {
    if (ready) {
      loadMachinesAndAlerts()
      const interval = setInterval(loadMachinesAndAlerts, 15000)
      return () => clearInterval(interval)
    }
  }, [ready, loadMachinesAndAlerts])

  // Gentle audio chime when a machine enters error state
  const prevMaintenanceCount = useRef(0)
  useEffect(() => {
    const maintenanceCount = machines.filter(m => m.status === 'maintenance').length
    if (maintenanceCount > prevMaintenanceCount.current && prevMaintenanceCount.current >= 0) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15) // A5
          gain.gain.setValueAtTime(0.3, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.5)
        }
      } catch (e) {
        // Autoplay policy restriction catch
      }
    }
    prevMaintenanceCount.current = maintenanceCount
  }, [machines])

  if (denied) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:C.bg,fontFamily:C.font,gap:16}}>
      <div style={{fontSize:48}}>🔒</div>
      <p style={{color:C.cream,fontWeight:700,fontSize:20}}>Access Denied</p>
      <p style={{color:C.muted}}>This account doesn't have admin privileges.</p>
      <button onClick={()=>router.push('/menu')} style={btnGold}>Go to Menu</button>
    </div>
  )

  if (!ready) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:C.bg}}>
      <div style={{width:40,height:40,border:`3px solid rgba(200,146,42,0.2)`,borderTopColor:C.gold,borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const maintenanceMachines = machines.filter(m => m.status === 'maintenance')

  const PLACEHOLDER_SECTIONS: Record<string, {title:string;desc:string;items:{icon:string;label:string;note:string}[]}> = {
    inventory: { title:'Inventory Management', desc:'Real-time stock levels per machine. Requires inventory table — run admin_extensions.sql.',
      items:[
        {icon:'🥤',label:'Cups Remaining',note:'Per-machine cup count with low alert threshold'},
        {icon:'☕',label:'Coffee Premix',note:'% remaining, consumption rate tracking'},
        {icon:'🥛',label:'Milk Premix',note:'% remaining with refill history'},
        {icon:'🍫',label:'Chocolate Mix',note:'% remaining for hot chocolate machines'},
        {icon:'💧',label:'Water Status',note:'Water level sensor integration'},
        {icon:'🔄',label:'Mark Refilled',note:'Log refill events with timestamp & staff ID'},
      ]
    },
    events: { title:'Event Logs', desc:'Every machine event stored for audit and troubleshooting.',
      items:[
        {icon:'📷',label:'QR Scanned',note:'Token scan attempt (success/fail)'},
        {icon:'✅',label:'Token Validated',note:'Valid token accepted by machine'},
        {icon:'☕',label:'Coffee Dispensed',note:'Brew cycle completed'},
        {icon:'🔄',label:'Machine Restarted',note:'Power cycle or software restart'},
        {icon:'📦',label:'Inventory Refilled',note:'Staff marked refill completed'},
        {icon:'💾',label:'Firmware Updated',note:'OTA update applied successfully'},
      ]
    },
    firmware: { title:'Firmware Management', desc:'Track and deploy firmware across all machines.',
      items:[
        {icon:'📟',label:'Current Version',note:'v1.0.0 — deployed on all machines'},
        {icon:'⬆️',label:'OTA Updates',note:'Push firmware updates over-the-air (future)'},
        {icon:'↩️',label:'Version Rollback',note:'Revert to previous stable version (future)'},
        {icon:'📋',label:'Update History',note:'Changelog and deployment log per machine'},
      ]
    },
    reports: { title:'Reports & Analytics', desc:'Export sales and operational reports.',
      items:[
        {icon:'📊',label:'Daily Sales',note:'Revenue and orders per day'},
        {icon:'📅',label:'Monthly Sales',note:'Monthly trend with comparison'},
        {icon:'☕',label:'Product-wise Sales',note:'Top performing drinks breakdown'},
        {icon:'⊡',label:'Machine-wise Sales',note:'Revenue per machine location'},
        {icon:'📦',label:'Inventory Consumption',note:'Ingredient usage tracking'},
        {icon:'📁',label:'Export CSV / Excel',note:'Download reports for offline analysis'},
      ]
    },
    customers: { title:'Customer Management', desc:'User accounts, order history and support tools.',
      items:[
        {icon:'👤',label:'User Profiles',note:'Name, phone, email, join date'},
        {icon:'📋',label:'Order History',note:'All purchases per customer'},
        {icon:'💰',label:'Total Spending',note:'Lifetime value per customer'},
        {icon:'🚫',label:'Disable Account',note:'Block a customer from ordering'},
        {icon:'💸',label:'Issue Refund',note:'Razorpay refund initiation'},
        {icon:'🔍',label:'Search & Filter',note:'Find customer by phone or email'},
      ]
    },
  }

  const renderContent = () => {
    if (tab==='dashboard')    return <DashboardSection/>
    if (tab==='products')     return <ProductsSection/>
    if (tab==='machines')     return <MachinesSection machines={machines} alerts={alerts} onRefresh={loadMachinesAndAlerts}/>
    if (tab==='transactions') return <TransactionsSection/>
    if (tab==='tokens')       return <TokensSection/>
    if (tab==='customers')    return <CustomersSection/>
    if (tab==='alerts')       return <AlertsSection machines={machines} alerts={alerts} onRefresh={loadMachinesAndAlerts}/>
    const ph = PLACEHOLDER_SECTIONS[tab]
    if (ph) return <PlaceholderSection {...ph}/>
    return null
  }

  return (
    <div className="admin-container" style={{display:'flex',minHeight:'100vh',background:C.bg,fontFamily:C.font,position:'relative',width:'100%'}}>

      {/* Mobile Top App Bar */}
      <div className="mobile-header">
        <button
          onClick={() => setMobileNavOpen(true)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${C.border}`,
            color: C.cream,
            fontSize: 20,
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
          }}
          aria-label="Toggle Navigation Menu"
        >
          ☰
          {maintenanceMachines.length > 0 && (
            <span style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: C.red,
              boxShadow: `0 0 8px ${C.red}`,
            }} />
          )}
        </button>

        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize: 18, fontWeight: 800}}>
            <span style={{color: '#FFFFFF'}}>cup</span>
            <span style={{background: `linear-gradient(135deg,${C.goldL},${C.gold})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>OS</span>
          </span>
          <span style={{color: C.goldL, fontSize: 12, fontWeight: 700, background: 'rgba(200,146,42,0.12)', padding: '3px 8px', borderRadius: 8}}>
            {NAV.find(n => n.id === tab)?.label || 'Console'}
          </span>
        </div>

        <button
          onClick={() => setTab('alerts')}
          style={{
            background: maintenanceMachines.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${maintenanceMachines.length > 0 ? C.red : C.border}`,
            color: maintenanceMachines.length > 0 ? C.red : C.muted,
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 10,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          {maintenanceMachines.length > 0 ? `🚨 ${maintenanceMachines.length}` : '✓ Normal'}
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`admin-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div style={{padding:'24px 20px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:20,fontWeight:800}}>
              <span style={{color:'#FFFFFF'}}>cup</span>
              <span style={{background:`linear-gradient(135deg,${C.goldL},${C.gold})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>OS</span>
            </div>
            <div style={{fontSize:10,color:C.muted,marginTop:2,textTransform:'uppercase',letterSpacing:1.5}}>Admin Console</div>
          </div>
          {/* Close button for mobile drawer */}
          <button
            onClick={() => setMobileNavOpen(false)}
            className="mobile-close-btn"
            style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:4}}
            aria-label="Close Navigation"
          >
            ✕
          </button>
        </div>

        <nav style={{flex:1,padding:'0 10px'}}>
          {NAV.map(n=>{
            const active=tab===n.id
            const isAlertTab = n.id === 'alerts'
            const isMachinesTab = n.id === 'machines'
            const showCount = (isAlertTab || isMachinesTab) && maintenanceMachines.length > 0

            return (
              <button key={n.id} onClick={()=>{ setTab(n.id); setMobileNavOpen(false); }} style={{
                width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',
                borderRadius:10,marginBottom:3,border:'none',cursor:'pointer',fontFamily:C.font,fontSize:13,fontWeight:active?700:500,
                background:active?`linear-gradient(135deg,${C.goldL}22,${C.gold}22)`:' transparent',
                color:active?C.goldL:C.muted,
                borderLeft:active?`3px solid ${C.gold}`:'3px solid transparent',
                transition:'all 0.15s',
              }}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:15,width:18,textAlign:'center'}}>{n.icon}</span>
                  {n.label}
                </div>
                {showCount && (
                  <span style={{
                    background: C.red,
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 10,
                    boxShadow: `0 0 8px ${C.red}`,
                  }}>
                    {maintenanceMachines.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
        <div style={{padding:'16px 20px',borderTop:`1px solid ${C.border}`}}>
          <p style={{color:C.muted,fontSize:11,marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{adminEmail}</p>
          <button onClick={async()=>{await supabase.auth.signOut();router.push('/')}} style={{...btnGhost,width:'100%',fontSize:11}}>Sign out</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          {/* Global Machine Alert Banner */}
          {maintenanceMachines.length > 0 && (
            <div className="alert-banner" style={{
              background: 'linear-gradient(90deg, rgba(239,68,68,0.22) 0%, rgba(220,38,38,0.3) 50%, rgba(239,68,68,0.22) 100%)',
              border: '1px solid rgba(239,68,68,0.5)',
              borderRadius: 14,
              padding: '14px 20px',
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 4px 20px rgba(239,68,68,0.15)',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:24}}>🚨</span>
                <div>
                  <div style={{color:'#FFFFFF',fontWeight:700,fontSize:14}}>
                    CRITICAL FAULT: {maintenanceMachines.length} Machine{maintenanceMachines.length > 1 ? 's' : ''} in Error State!
                  </div>
                  <div style={{color:'rgba(255,255,255,0.9)',fontSize:12,marginTop:4,display:'flex',flexDirection:'column',gap:4}}>
                    {maintenanceMachines.map(m => {
                      const alert = alerts.find(a => a.machineId === m.machine_code && !a.resolved)
                      const meta = getErrorMetadata(alert?.errorCode || 'MACHINE_IN_ERROR_STATE')
                      return (
                        <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <span style={{fontWeight:600,color:C.cream}}>{m.machine_name} ({m.machine_code}):</span>
                          <span style={{
                            background:'rgba(239,68,68,0.25)',
                            color:'#FFFFFF',
                            border:'1px solid rgba(239,68,68,0.5)',
                            padding:'1px 8px',
                            borderRadius:6,
                            fontSize:11,
                            fontWeight:700,
                            fontFamily:'monospace'
                          }}>
                            {meta.icon} {meta.code}
                          </span>
                          <span style={{color:'rgba(255,255,255,0.7)',fontSize:12}}>
                            — {alert?.details || meta.description}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div>
                <button
                  onClick={() => setTab('alerts')}
                  style={{...btnGold, padding:'8px 14px', fontSize:12}}
                >
                  View Alerts Console →
                </button>
              </div>
            </div>
          )}

          {renderContent()}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }

        /* Desktop layout */
        .admin-sidebar {
          width: 240px;
          background: #0A0806;
          border-right: 1px solid rgba(200,146,42,0.14);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          overflow-y: auto;
          z-index: 50;
          transition: transform 0.25s ease-in-out;
        }
        .admin-main {
          flex: 1;
          margin-left: 240px;
          padding: 32px 36px;
          min-height: 100vh;
          width: calc(100% - 240px);
        }
        .mobile-header {
          display: none;
        }
        .mobile-close-btn {
          display: none;
        }
        .sidebar-backdrop {
          display: none;
        }

        /* Mobile layout (<= 768px) */
        @media (max-width: 768px) {
          .admin-sidebar {
            position: fixed !important;
            top: 0;
            left: 0;
            bottom: 0;
            width: 280px !important;
            transform: translateX(-100%);
            box-shadow: 6px 0 24px rgba(0,0,0,0.9);
          }
          .admin-sidebar.open {
            transform: translateX(0);
          }
          .mobile-close-btn {
            display: block !important;
          }
          .sidebar-backdrop {
            display: block !important;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.65);
            backdrop-filter: blur(4px);
            z-index: 45;
          }
          .mobile-header {
            display: flex !important;
            align-items: center;
            justifyContent: space-between;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 58px;
            background: rgba(10, 8, 6, 0.95);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(200, 146, 42, 0.14);
            padding: 0 16px;
            z-index: 40;
          }
          .admin-main {
            margin-left: 0 !important;
            width: 100% !important;
            padding: 16px 14px 40px !important;
            padding-top: 74px !important;
          }
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          .chart-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .filter-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .filter-row input, .filter-row select, .filter-row button {
            width: 100% !important;
          }
          .alert-banner {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .alert-banner button {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}
