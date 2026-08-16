'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────
type Stats = { totalMachines:number; onlineMachines:number; offlineMachines:number; revenueToday:number; ordersToday:number; revenueMonth:number; coffeeToday:number; activeCustomers:number; productStats:{name:string;full:number;half:number;total:number}[]; sizeStats:{full:number;half:number}; revenueTrend:{date:string;revenue:number}[] }
type Machine = { id:string; machine_code:string; machine_name:string; location:string; status:string; last_seen:string; firmware_version:string }
type Transaction = { id:string; order_id:string; payment_amount:number; payment_status:string; phone:string; created_at:string; products:{name:string;price:number}[] }
type Token = { id:string; token:string; status:string; created_at:string; expires_at:string; redeemed_at:string|null; phone:string; products:{name:string} }
type Product = { id?:string; name:string; description:string; price:number; active:boolean; relay_id:number; dispense_time_ms:number; allow_half:boolean; half_price:number }
type Customer = { id:string; name:string; email:string|null; phone:string|null; created_at:string; wallet_balance:number; total_spent:number }

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
    fetch('/api/admin/stats').then(r=>r.json()).then(setStats)
    fetch('/api/admin/transactions?').then(r=>r.json()).then(d=>setTxns((d.transactions??[]).slice(0,8)))
  },[])
  if(!stats) return <p style={{color:C.muted}}>Loading...</p>
  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
        <KPI label="Revenue Today"     value={rupee(stats.revenueToday)}  sub={`${stats.ordersToday} orders`} />
        <KPI label="Revenue This Month" value={rupee(stats.revenueMonth)} color={C.goldL} />
        <KPI label="Coffee Dispensed"  value={`${stats.coffeeToday}`}     sub="today" color='#a78bfa' />
        <KPI label="Machines Online"   value={`${stats.onlineMachines}/${stats.totalMachines}`} color={stats.onlineMachines>0?C.green:C.red} sub={`${stats.offlineMachines} offline`} />
        <KPI label="Active Customers"  value={`${stats.activeCustomers}`} sub="this month" color='#60a5fa' />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:24}}>
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
            <p style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1.5,marginBottom:14}}>7-Day Revenue Trend</p>
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',height:80,gap:4}}>
              {stats.revenueTrend.map((t,i) => {
                const max = Math.max(...stats.revenueTrend.map(x=>x.revenue), 1)
                const h = Math.max((t.revenue / max) * 100, 4)
                return (
                  <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,flex:1}}>
                    <div style={{width:'100%',height:80,display:'flex',alignItems:'flex-end'}}>
                      <div style={{width:'100%',height:`${h}%`,background:t.revenue>0?C.gold:'rgba(255,255,255,0.05)',borderRadius:4}} title={rupee(t.revenue)} />
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
function MachinesSection() {
  const [machines,setMachines]=useState<Machine[]>([])
  const load=useCallback(()=>{ fetch('/api/admin/machines').then(r=>r.json()).then(d=>setMachines(d.machines??[])) },[])
  useEffect(()=>{ load() },[load])
  const toggle=async(m:Machine)=>{
    const next=m.status==='online'?'offline':'online'
    await fetch('/api/admin/machines',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({machineId:m.id,status:next})})
    load()
  }
  return (
    <div>
      <h2 style={{color:C.cream,fontSize:22,fontWeight:700,marginBottom:20}}>Machine Management</h2>
      <div style={{overflowX:'auto',...card,padding:0}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted,background:'rgba(255,255,255,0.02)'}}>
            {['Machine ID','Name','Location','Status','Last Heartbeat','Firmware','Action'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{machines.map(m=>(
            <tr key={m.id} style={{borderTop:`1px solid rgba(255,255,255,0.04)`}}>
              <td style={{padding:'12px 16px',color:C.cream,fontFamily:'monospace',fontSize:12}}>{m.machine_code}</td>
              <td style={{padding:'12px 16px',color:C.cream,fontWeight:600}}>{m.machine_name}</td>
              <td style={{padding:'12px 16px',color:C.muted}}>{m.location}</td>
              <td style={{padding:'12px 16px'}}><span style={badge(m.status==='online'?C.green:C.red)}>{m.status}</span></td>
              <td style={{padding:'12px 16px',color:C.muted,fontSize:12}}>{m.last_seen?ago(m.last_seen):'Never'}</td>
              <td style={{padding:'12px 16px',color:C.muted,fontSize:12}}>{m.firmware_version??'—'}</td>
              <td style={{padding:'12px 16px'}}>
                <button onClick={()=>toggle(m)} style={{...btnGhost,color:m.status==='online'?C.red:C.green}}>
                  {m.status==='online'?'Disable':'Enable'}
                </button>
              </td>
            </tr>
          ))}</tbody>
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
      <div style={{display:'flex',gap:10,flexWrap:'wrap' as const}}>
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
  const [tokens,setTokens]=useState<Token[]>([])
  const [search,setSearch]=useState(''); const [statusF,setStatusF]=useState('')
  const load=()=>{
    const p=new URLSearchParams(); if(search)p.set('search',search); if(statusF)p.set('status',statusF)
    fetch(`/api/admin/tokens?${p}`).then(r=>r.json()).then(d=>setTokens(d.tokens??[]))
  }
  useEffect(()=>{ load() },[])
  const cancel=async(id:string)=>{
    await fetch('/api/admin/tokens',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tokenId:id})})
    load()
  }
  const statusColor:Record<string,string>={UNUSED:C.gold,REDEEMED:C.green,EXPIRED:C.muted,CANCELLED:C.red}
  const inp = { background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px', color:C.cream, fontSize:13, fontFamily:C.font, outline:'none' }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <h2 style={{color:C.cream,fontSize:22,fontWeight:700}}>Token Management</h2>
      <div style={{display:'flex',gap:10,flexWrap:'wrap' as const}}>
        <input placeholder="Search token…" value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,width:200}} />
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{...inp,cursor:'pointer'}}>
          <option value="">All Status</option>
          {['UNUSED','REDEEMED','EXPIRED','CANCELLED'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} style={btnGold}>Search</button>
      </div>
      <div style={{...card,padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted}}>
            {['Token','Product','Status','Phone','Created','Redeemed','Action'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{tokens.map(t=>(
            <tr key={t.id} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
              <td style={{padding:'11px 16px',color:C.cream,fontFamily:'monospace',fontSize:12}}>{t.token}</td>
              <td style={{padding:'11px 16px',color:C.cream}}>{(t.products as {name:string}|null)?.name||'—'}</td>
              <td style={{padding:'11px 16px'}}><span style={badge(statusColor[t.status]||C.muted)}>{t.status}</span></td>
              <td style={{padding:'11px 16px',color:C.muted}}>{t.phone||'—'}</td>
              <td style={{padding:'11px 16px',color:C.muted,fontSize:12}}>{fmt(t.created_at)}</td>
              <td style={{padding:'11px 16px',color:C.muted,fontSize:12}}>{t.redeemed_at?fmt(t.redeemed_at):'—'}</td>
              <td style={{padding:'11px 16px'}}>
                {t.status==='UNUSED'&&<button onClick={()=>cancel(t.id)} style={{...btnGhost,color:C.red,fontSize:11}}>Cancel</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
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

  useEffect(() => {
    fetch('/api/admin/customers').then(r => r.json()).then(d => {
      setCustomers(d.customers ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <p style={{color:C.muted}}>Loading customers...</p>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <h2 style={{color:C.cream,fontSize:22,fontWeight:700}}>Customer Management</h2>

      <div style={{...card,padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{color:C.muted}}>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>User</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Joined</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Wallet Balance</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Total Spent</th>
            <th style={{textAlign:'left',padding:'12px 16px',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Action</th>
          </tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                <td style={{padding:'11px 16px'}}>
                  <div style={{color:C.cream, fontWeight:600}}>{c.name}</div>
                  <div style={{color:C.muted, fontSize:12, marginTop:2}}>{c.phone || c.email || 'No contact info'}</div>
                </td>
                <td style={{padding:'11px 16px',color:C.muted}}>{fmt(c.created_at)}</td>
                <td style={{padding:'11px 16px'}}>
                  <span style={{color: C.goldL, fontWeight: 700}}>{rupee(c.wallet_balance)}</span>
                </td>
                <td style={{padding:'11px 16px',color:C.muted}}>{rupee(c.total_spent)}</td>
                <td style={{padding:'11px 16px'}}>
                  <button style={{...btnGhost, fontSize:11}}>View Orders</button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={5} style={{padding:'20px',textAlign:'center',color:C.muted}}>No customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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

      // Check specific email
      if (user.email === allowed || user.phone === allowed) {
        setAdminEmail(user.email || user.phone || 'Admin')
        setReady(true)
      } else {
        setDenied(true)
      }
    })
  },[router])

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
    alerts: { title:'Alerts & Fault Management', desc:'Machine health alerts by severity level.',
      items:[
        {icon:'🔴',label:'Machine Offline',note:'Critical: Machine unreachable for >5 min'},
        {icon:'🟡',label:'Cup Empty',note:'Warning: Cup count below threshold'},
        {icon:'🟡',label:'Water Low',note:'Warning: Water sensor triggered'},
        {icon:'🟡',label:'Ingredient Low',note:'Warning: Premix below 20%'},
        {icon:'🔴',label:'Sensor Failure',note:'Critical: Sensor hardware error'},
        {icon:'🔵',label:'Payment Failure',note:'Info: Failed payment attempt logged'},
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
    if (tab==='machines')     return <MachinesSection/>
    if (tab==='transactions') return <TransactionsSection/>
    if (tab==='tokens')       return <TokensSection/>
    if (tab==='customers')    return <CustomersSection/>
    const ph = PLACEHOLDER_SECTIONS[tab]
    if (ph) return <PlaceholderSection {...ph}/>
    return null
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.bg,fontFamily:C.font}}>

      {/* Sidebar */}
      <div style={{width:220,background:C.side,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,height:'100vh',overflowY:'auto',zIndex:10}}>
        <div style={{padding:'28px 20px 20px'}}>
          <div style={{fontSize:20,fontWeight:800}}>
            <span style={{color:'#FFFFFF'}}>cup</span>
            <span style={{background:`linear-gradient(135deg,${C.goldL},${C.gold})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>OS</span>
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:2,textTransform:'uppercase',letterSpacing:1.5}}>Admin Console</div>
        </div>
        <nav style={{flex:1,padding:'0 10px'}}>
          {NAV.map(n=>{
            const active=tab===n.id
            return (
              <button key={n.id} onClick={()=>setTab(n.id)} style={{
                width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                borderRadius:10,marginBottom:2,border:'none',cursor:'pointer',fontFamily:C.font,fontSize:13,fontWeight:active?700:500,
                background:active?`linear-gradient(135deg,${C.goldL}22,${C.gold}22)`:' transparent',
                color:active?C.goldL:C.muted,
                borderLeft:active?`3px solid ${C.gold}`:'3px solid transparent',
                transition:'all 0.15s',
              }}>
                <span style={{fontSize:15,width:18,textAlign:'center'}}>{n.icon}</span>
                {n.label}
              </button>
            )
          })}
        </nav>
        <div style={{padding:'16px 20px',borderTop:`1px solid ${C.border}`}}>
          <p style={{color:C.muted,fontSize:11,marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{adminEmail}</p>
          <button onClick={async()=>{await supabase.auth.signOut();router.push('/')}} style={{...btnGhost,width:'100%',fontSize:11}}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <main style={{flex:1,marginLeft:220,padding:'32px',minHeight:'100vh'}}>
        <div style={{maxWidth:1100}}>
          {renderContent()}
        </div>
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;margin:0;padding:0}`}</style>
    </div>
  )
}
