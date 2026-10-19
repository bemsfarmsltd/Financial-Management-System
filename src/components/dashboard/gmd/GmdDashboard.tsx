'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Building2, Check, ChevronRight, Clock3, FileText, Plus, RotateCcw, Search, ShieldCheck, Wallet, X } from 'lucide-react';
import { TopographicBackground } from '../exact-cards/CardPatterns';
import { AS_OF, BUDGETS, COMPANIES, SEED, STORAGE_KEY, VIEW_LABELS, Approval, GmdView, Obligation, dateLabel, isOverdue, metrics, money, sum, validRows } from './demo';
import { SubsidiaryPortfolioView } from './SubsidiaryPortfolioView';
import { ApprovalsDeskView } from './ApprovalsDeskView';
import { ApprovalMatrixView } from './ApprovalMatrixView';
import { EmergencyOverridesView } from './EmergencyOverridesView';
import { DisbursementsDeskView } from './DisbursementsDeskView';
import { TreasuryAccountsView } from './TreasuryAccountsView';
import { PayrollSignOffView } from './PayrollSignOffView';
import styles from './gmd.module.css';

type Props = { businessName: string; userName: string; view?: GmdView; onNavigate: (name: string) => void; onSelectBusiness?: (id: string) => void };
type Panel = { type:'record'; id:string } | { type:'list'; title:string; filter:'all'|'pending'|'paid'|'open'|'committed' } | { type:'create' } | { type:'reset' } | null;

function Modal({title, children, onClose}: {title:string; children:ReactNode; onClose:()=>void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="gmd-dialog-title" onCancel={onClose} onClick={e => {if(e.target === e.currentTarget) onClose();}}>
    <header className={styles.dialogHeader}><div><span className={styles.eyebrow}>BEMS GROUP · DEMO WORKSPACE</span><h2 id="gmd-dialog-title">{title}</h2></div><button className={styles.iconButton} aria-label="Close dialog" onClick={onClose}><X size={20}/></button></header>
    <div className={styles.dialogBody}>{children}</div>
  </dialog>;
}
function Badge({children, tone='neutral'}: {children:ReactNode; tone?:'neutral'|'green'|'amber'|'red'|'blue'}) {return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;}
function Empty({title='Nothing here yet',text='Try another company, period or search.'}: {title?:string;text?:string}) {return <div className={styles.empty}><ShieldCheck size={28}/><h3>{title}</h3><p>{text}</p></div>;}
function ApprovalBadge({value}: {value:Approval}) {return <Badge tone={value==='Approved'?'green':value==='Rejected'?'red':value==='Pending'?'amber':'blue'}>{value === 'Pending' ? 'Awaiting GMD' : value}</Badge>;}

export function GmdDashboard({ businessName, userName, view='overview', onNavigate, onSelectBusiness }: Props) {
  if (view === 'portfolio') {
    return (
      <div className={styles.dashboard}>
        <SubsidiaryPortfolioView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      </div>
    );
  }

  if (view === 'approvals') {
    return (
      <div className={styles.dashboard}>
        <ApprovalsDeskView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      </div>
    );
  }

  if (view === 'matrix') {
    return (
      <div className={styles.dashboard}>
        <ApprovalMatrixView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      </div>
    );
  }

  if (view === 'emergency') {
    return (
      <div className={styles.dashboard}>
        <EmergencyOverridesView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      </div>
    );
  }

  if (view === 'payments') {
    return (
      <div className={styles.dashboard}>
        <DisbursementsDeskView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      </div>
    );
  }

  if (view === 'treasury') {
    return (
      <div className={styles.dashboard}>
        <TreasuryAccountsView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      </div>
    );
  }

  if (view === 'payroll') {
    return (
      <div className={styles.dashboard}>
        <PayrollSignOffView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      </div>
    );
  }

  const [rows, setRows] = useState<Obligation[]>(SEED);
  const [loaded, setLoaded] = useState(false);
  const [scope, setScope] = useState(businessName);
  const [period, setPeriod] = useState('2026-10');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  const [decision, setDecision] = useState<Approval>('Approved');
  const [reason, setReason] = useState('');
  const [detailTab, setDetailTab] = useState('Overview');
  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if(saved) {const parsed:unknown=JSON.parse(saved); if(validRows(parsed)) setRows(parsed); else setStorageWarning('Saved demo data could not be read. Showing the original sample records.');} }
    catch {setStorageWarning('Local saving is unavailable. Changes will last for this session only.');}
    setLoaded(true);
  }, []);
  useEffect(() => {if(loaded) {try {localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));} catch {setStorageWarning('Changes could not be saved locally. Keep this page open to retain this session.');}}}, [rows,loaded]);
  useEffect(() => {setScope(businessName);},[businessName]);
  useEffect(() => {setQuery('');setStatus('All');setPanel(null);},[view]);
  useEffect(() => {if(!notice) return; const id=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(id);},[notice]);
  const companies = Array.from(new Set([...COMPANIES,businessName,...rows.map(r=>r.company)]));
  const filtered = useMemo(() => rows.filter(r => (scope==='ALL'||r.company===scope) && r.date.startsWith(period)),[rows,scope,period]);
  const stats = metrics(filtered);
  const pendingExpenses = stats.pending.filter(r=>r.kind!=='Payroll');
  const payroll = filtered.filter(r=>r.kind==='Payroll');
  const overdue = stats.open.filter(isOverdue);
  const budget = (scope==='ALL'? Object.values(BUDGETS).reduce((a,b)=>a+b,0):BUDGETS[scope]) ?? 0;
  const used = sum(stats.paid)+sum(stats.committed);
  const utilisation = budget ? Math.round(used/budget*100) : 0;
  const selected = panel?.type==='record' ? rows.find(r=>r.id===panel.id) : undefined;
  const periodName = period==='2026-10'?'October 2026':'September 2026';
  const scopeName = scope==='ALL'?'All group companies':scope;
  const openRecord = (row:Obligation) => {setDetailTab('Overview');setReason('');setDecision('Approved');setPanel({type:'record',id:row.id});};
  const navigate = (next:GmdView) => onNavigate(VIEW_LABELS[next]);
  const list = (title:string, filter:'all'|'pending'|'paid'|'open'|'committed') => setPanel({type:'list',title,filter});
  const notify = (text:string) => setNotice(text);
  const decide = (e:FormEvent) => {
    e.preventDefault(); if(!selected || selected.approval!=='Pending' || !reason.trim() || selected.owner===userName) return;
    const entry={text:`${userName}: ${decision}. ${reason.trim()}`,at:new Date().toISOString()};
    setRows(current=>current.map(r=>r.id===selected.id && r.approval==='Pending'?{...r,approval:decision,history:[...r.history,entry]}:r));
    setReason('');setDetailTab('Activity');notify(`${selected.id}: ${decision.toLowerCase()} saved in the demo.`);
  };
  const comment = (e:FormEvent) => {e.preventDefault();if(!selected||!reason.trim())return;const text=reason.trim();setRows(current=>current.map(r=>r.id===selected.id?{...r,history:[...r.history,{text:`${userName}: ${text}`,at:new Date().toISOString()}]}:r));setReason('');notify('Note added to the demo timeline.');};
  const exportCsv = () => {
    const cell=(v:string|number)=>`"${String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;
    const csv=[['Reference','Title','Company','Type','Amount NGN','Approval','Payment','Accountability','Submitted','Due'],...filtered.map(r=>[r.id,r.title,r.company,r.kind,r.amount/100,r.approval,r.payment,r.closed?'Closed':r.payment==='Verified'?'Open':'Not started',r.date,r.due])].map(row=>row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`BEMS-executive-${period}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(`Exported ${filtered.length} records for ${scopeName}.`);
  };
  const recordList = (records:Obligation[], compact=false) => records.length ? <div className={styles.recordList}>{records.map(r=><button className={styles.record} key={r.id} onClick={()=>openRecord(r)}>
    <span className={`${styles.recordIcon} ${r.kind==='Payroll'?styles.purple:''}`}><FileText size={19}/></span>
    <span className={styles.recordInfo}><strong>{r.title}</strong><small>{r.id} · {scope==='ALL'?r.company:r.owner}</small>{!compact&&<small>Due {dateLabel(r.due)}{isOverdue(r)?' · Delivery overdue':''}</small>}</span>
    <span className={styles.recordAmount}><strong>{money(r.amount)}</strong><ApprovalBadge value={r.approval}/></span><ChevronRight size={16}/>
  </button>)}</div>:<Empty title={'No matching records'}/>;
  const events=filtered.flatMap(r=>r.history.map((h,i)=>({...h,id:`${r.id}-${i}`,row:r}))).sort((a,b)=>b.at.localeCompare(a.at));
  const portfolio = <section className={styles.card}>
    <div className={styles.sectionHead}><div><span className={styles.eyebrow}>COMPANY EXPOSURE</span><h2>Budgets & commitments</h2><p>{periodName} · Verified payments and unpaid approved obligations</p></div><Building2 size={22}/></div>
    <div className={styles.tableWrap}><table><thead><tr><th>Company</th><th>Budget</th><th>Verified paid</th><th>Committed</th><th>Available</th><th>Utilisation</th></tr></thead><tbody>{companies.filter(c=>scope==='ALL'||c===scope).map(c=>{const m=metrics(filtered.filter(r=>r.company===c));const b=BUDGETS[c]||0;const expense=sum(m.paid)+sum(m.committed);const pct=b?Math.round(expense/b*100):0;return <tr key={c}><td><button className={styles.textButton} onClick={()=>{setScope(c);notify(`Showing ${c}.`);}}>{c}<ArrowUpRight size={13}/></button></td><td>{b?money(b,true):'Not set'}</td><td>{money(sum(m.paid),true)}</td><td>{money(sum(m.committed),true)}</td><td>{b?money(b-expense,true):'—'}</td><td><span>{b?`${pct}%`:'—'}</span><div className={styles.track}><i style={{width:`${Math.min(pct,100)}%`,background:pct>=80?'#d97706':'#ea580c'}}/></div></td></tr>;})}</tbody></table></div>
    <p className={styles.footnote}>Pending approvals are excluded from commitments. Advances are cash paid, not automatically recognised expenses. These are sample monthly allocations.</p>
  </section>;
  const activity = <section className={styles.card}><div className={styles.sectionHead}><div><span className={styles.eyebrow}>DECISIONS & MOVEMENT</span><h2>Recent activity</h2></div>{view!=='audit'&&<button className={styles.textButton} onClick={()=>navigate('audit')}>View all <ArrowUpRight size={14}/></button>}</div><div className={styles.timeline}>{events.slice(0,view==='audit'?100:5).map(event=><button key={event.id} onClick={()=>{openRecord(event.row);setDetailTab('Activity');}}><span className={styles.timelineDot}/><span><strong>{event.text}</strong><small>{event.row.id} · {new Date(event.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></span><ChevronRight size={14}/></button>)}</div>{!events.length&&<Empty/>}</section>;

  return <div className={styles.dashboard}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>EXECUTIVE COMMAND / {VIEW_LABELS[view].toUpperCase()}</span><h1>{view==='overview'?`Welcome back, ${userName.split(' ')[0]}.`:VIEW_LABELS[view]}</h1><p>{view==='overview'?'A clear view of your money, decisions and outstanding delivery.':`Review ${VIEW_LABELS[view].toLowerCase()} across your selected company and period.`}</p></div><div className={styles.actions}><button className={styles.secondary} onClick={exportCsv}><ArrowDownToLine size={16}/> Export</button></div></header>
    <div className={styles.toolbar}><div className={styles.filters}><label>Company<select aria-label="Dashboard company" value={scope} onChange={e=>setScope(e.target.value)}><option value="ALL">All group companies</option>{companies.map(c=><option key={c}>{c}</option>)}</select></label><label>Reporting period<select aria-label="Reporting period" value={period} onChange={e=>setPeriod(e.target.value)}><option value="2026-10">October 2026</option><option value="2026-09">September 2026</option></select></label></div><div className={styles.demo}><i/> Demo data · as of 15 Oct 2026<button aria-label="Reset demo data" title="Reset demo data" onClick={()=>setPanel({type:'reset'})}><RotateCcw size={14}/></button></div></div>
    {storageWarning&&<div className={styles.warning} role="status">{storageWarning}</div>}
    {notice&&<div className={styles.notice} role="status"><Check size={16}/>{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {!loaded?<section className={styles.card} aria-busy="true"><p>Loading your executive workspace…</p></section>:<>
    {view!=='overview'&&<button className={styles.back} onClick={()=>navigate('overview')}>← Back to overview</button>}
    {(view==='overview'||view==='briefing')&&<>
      <div className={styles.metrics}>
        {[
          {title:'Awaiting your decision',value:String(stats.pending.length),caption:`${money(sum(stats.pending),true)} across requests & payroll`,filter:'pending' as const,icon:Clock3,primary:true},
          {title:'Verified cash paid',value:money(sum(stats.paid),true),caption:`${stats.paid.length} independently verified payments`,filter:'paid' as const,icon:Wallet},
          {title:'Approved commitments',value:money(sum(stats.committed),true),caption:'Approved · settlement not yet verified',filter:'committed' as const,icon:FileText},
          {title:'Paid, awaiting delivery',value:money(sum(stats.open),true),caption:`${stats.open.length} open cases · ${overdue.length} overdue`,filter:'open' as const,icon:ShieldCheck},
        ].map(metric=><button key={metric.title} className={`${styles.metric} ${metric.primary?styles.primaryMetric:''}`} onClick={()=>list(metric.title,metric.filter)}><span>{metric.title}<span className={styles.metricArrow}><ArrowUpRight size={18}/></span></span><strong>{metric.value}</strong><small><metric.icon size={13}/>{metric.caption}</small></button>)}
      </div>
      <div className={styles.mainGrid}>
        <section className={styles.card}><div className={styles.sectionHead}><div><span className={styles.eyebrow}>YOUR NEXT DECISIONS</span><h2>Executive approval queue <span className={styles.count}>{pendingExpenses.length}</span></h2></div><button className={styles.textButton} onClick={()=>navigate('approvals')}>View all <ArrowUpRight size={14}/></button></div>{recordList(pendingExpenses.slice(0,3))}<div className={styles.queueFooter}><ShieldCheck size={15}/>Every decision stays attached to its request.</div></section>
        <section className={`${styles.card} ${styles.focusCard}`}><TopographicBackground/><div className={styles.focusContent}><span className={styles.eyebrow}>MANAGEMENT ATTENTION</span><h2>{overdue.length?'Paid. Still awaiting proof.':'Keep delivery in view.'}</h2><strong>{money(sum(overdue),true)}</strong><p>{overdue.length?`${overdue.length} paid ${overdue.length===1?'case is':'cases are'} past the delivery deadline. Follow up with the owner before closure.`:'No overdue paid cases in this selection. Review open deliverables to keep them on track.'}</p><button onClick={()=>navigate('accountability')}>Review accountability <ArrowUpRight size={17}/></button></div></section>
      </div>
      <div className={styles.mainGrid}>
        <section className={styles.card}><div className={styles.sectionHead}><div><span className={styles.eyebrow}>OBLIGATION LIFECYCLE</span><h2>From request to accountability</h2><p>Counts within the selected submission period · includes payroll</p></div><button className={styles.textButton} onClick={()=>list('All obligations','all')}>Explore <ArrowUpRight size={14}/></button></div><div className={styles.pipeline}>{[
          {label:'Submitted',items:filtered,filter:'all' as const},
          {label:'Approved',items:filtered.filter(r=>r.approval==='Approved'),filter:'committed' as const},
          {label:'Payment recorded',items:filtered.filter(r=>r.payment!=='Unpaid'),filter:'all' as const},
          {label:'Verified paid',items:stats.paid,filter:'paid' as const},
          {label:'Accounted for',items:stats.closed,filter:'paid' as const},
        ].map((stage,i)=><div key={stage.label} className={styles.stage}><div><strong>{stage.items.length}</strong><span>{money(sum(stage.items),true)}</span></div><div className={styles.barArea}><i style={{height:`${filtered.length?Math.max(stage.items.length/filtered.length*100,3):3}%`,opacity:1-i*.12}}/></div><span>{stage.label}</span></div>)}</div><p className={styles.footnote}>Stages overlap. Approval, cash settlement and delivery completion are tracked separately.</p></section>
        <section className={styles.card}><div className={styles.sectionHead}><div><span className={styles.eyebrow}>SPENDING CAPACITY</span><h2>Budget position</h2></div><Wallet size={20}/></div><div className={styles.budgetNumber}>{budget?money(budget-used,true):'Not set'}</div><p className={styles.muted}>Available after paid and committed amounts</p><div className={styles.budgetTrack}><i style={{width:`${Math.min(utilisation,100)}%`,background:utilisation>=80?'#d97706':undefined}}/></div><dl className={styles.summary}><div><dt>Monthly allocation</dt><dd>{budget?money(budget,true):'Not set'}</dd></div><div><dt>Paid + committed</dt><dd>{money(used,true)}</dd></div><div><dt>Pending decision</dt><dd>{money(sum(stats.pending),true)}</dd></div></dl><button className={styles.secondary} onClick={()=>navigate('portfolio')}>View company breakdown <ArrowUpRight size={15}/></button></section>
      </div>
      {portfolio}
      <div className={styles.mainGrid}>
        <section className={styles.card}><div className={styles.sectionHead}><div><span className={styles.eyebrow}>PEOPLE & PAYROLL</span><h2>Payroll sign-off</h2><p>HR-prepared batches awaiting executive review</p></div><button className={styles.textButton} onClick={()=>navigate('payroll')}>View batches <ArrowUpRight size={14}/></button></div>{recordList(payroll,true)}<p className={styles.footnote}>Approving a batch authorises Finance to proceed; it does not mark salaries as paid.</p></section>
        {activity}
      </div>
    </>}
    {view==='audit'&&activity}
    {(['requests','payments','accountability','payroll'] as readonly string[]).includes(view)&&<section className={styles.card}><div className={styles.sectionHead}><div><h2>{VIEW_LABELS[view]}</h2><p>{(view as string)==='payments'?'Review recorded and verified transfers. Payment execution remains with Finance.':(view as string)==='accountability'?'Review owners, delivery deadlines and evidence. Independent verifiers close cases.':(view as string)==='payroll'?'Inspect each HR-prepared batch before sign-off.':'Open a record to inspect its context, evidence and decision history.'}</p></div></div><div className={styles.listTools}><label className={styles.search}><Search size={16}/><input aria-label="Search obligations" placeholder="Search title, reference or owner" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Approval status" value={status} onChange={e=>setStatus(e.target.value)}>{['All','Pending','Approved','Clarification','Rejected'].map(s=><option key={s}>{s}</option>)}</select></div>{recordList(filtered.filter(r=>(view as string)==='payments'?r.approval==='Approved':(view as string)==='accountability'?r.payment==='Verified':(view as string)==='payroll'?r.kind==='Payroll':true).filter(r=>status==='All'||r.approval===status).filter(r=>`${r.title} ${r.id} ${r.owner}`.toLowerCase().includes(query.toLowerCase())))}</section>}
    </>}
    <footer className={styles.footer}><ShieldCheck size={14}/>Frontend preview · Decisions are stored on this browser. No funds are transferred.</footer>

    {panel&&<Modal title={panel.type==='record'?(selected?.title||'Record unavailable'):panel.type==='list'?panel.title:panel.type==='create'?'New fund request':'Reset demo workspace'} onClose={()=>setPanel(null)}>
      {panel.type==='list'&&<><p className={styles.muted}>{scopeName} · {periodName}</p>{recordList(panel.filter==='all'?filtered:stats[panel.filter])}</>}
      {panel.type==='reset'&&<><p>Restore the original sample records? This removes your locally saved demo requests, decisions and comments. It does not change the database.</p><div className={styles.actions}><button className={styles.secondary} onClick={()=>setPanel(null)}>Keep my changes</button><button className={styles.danger} onClick={()=>{setRows(SEED);setPanel(null);notify('Demo workspace restored.');}}>Reset demo</button></div></>}
      {panel.type==='create'&&<NewRequest company={scope==='ALL'?businessName:scope} companies={companies} userName={userName} onSave={record=>{setRows(current=>[record,...current]);setPeriod('2026-10');setScope(record.company);setPanel({type:'record',id:record.id});setDetailTab('Overview');notify(`${record.id} submitted in the demo.`);}}/>}
      {selected&&<>
        <div className={styles.detailTop}><div><span className={styles.eyebrow}>{selected.id} · {selected.kind}</span><strong>{money(selected.amount)}</strong><span>{selected.company}</span></div><ApprovalBadge value={selected.approval}/></div>
        <div className={styles.detailStatuses}><span>Approval <b>{selected.approval}</b></span><span>Payment <b>{selected.payment}</b></span><span>Accountability <b>{selected.closed?'Closed':selected.payment==='Verified'?'Open':'Not started'}</b></span></div>
        <div className={styles.tabs} role="tablist" aria-label="Record details">{['Overview','Evidence','Activity'].map(t=><button key={t} role="tab" aria-selected={detailTab===t} aria-controls="gmd-detail-panel" id={`gmd-tab-${t}`} onClick={()=>{setDetailTab(t);setReason('');}}>{t}{t==='Evidence'?` (${selected.evidence.length})`:''}</button>)}</div>
        <div role="tabpanel" id="gmd-detail-panel" aria-labelledby={`gmd-tab-${detailTab}`}>
          {detailTab==='Overview'&&<><dl className={styles.detailGrid}><div><dt>Requested by</dt><dd>{selected.owner}</dd></div><div><dt>Category</dt><dd>{selected.category}</dd></div><div><dt>Submitted</dt><dd>{dateLabel(selected.date)}</dd></div><div><dt>Delivery / payment due</dt><dd>{dateLabel(selected.due)} {isOverdue(selected)&&<Badge tone="red">Overdue</Badge>}</dd></div></dl><h3>Business justification</h3><p>{selected.purpose}</p><h3>Required deliverable</h3><p>{selected.deliverable}</p>{selected.kind==='Payroll'&&<div className={styles.info}>This sample represents a prepared salary batch. Employee payslips, deductions and allocation details will be completed in the HR frontend.</div>}<div className={styles.info}><ShieldCheck size={18}/><span>{selected.payment==='Verified'?'Payment is verified. Delivery evidence is reviewed separately by the assigned verifier.':selected.payment==='Recorded'?'A transfer has been recorded. Independent settlement verification is still outstanding.':'Approval authorises spending. Finance records the external transfer and a separate verifier confirms settlement.'}</span></div></>}
          {detailTab==='Evidence'&&<><p className={styles.muted}>Sample document checklist. File previews will appear here when receipt upload is connected.</p>{selected.evidence.map(e=><div className={styles.evidence} key={e}><FileText size={20}/><div><strong>{e}</strong><small>Illustrative record · no file attached</small></div><Badge>Sample</Badge></div>)}<h3>Required for closure</h3><p>{selected.deliverable}</p></>}
          {detailTab==='Activity'&&<><ol className={styles.history}>{selected.history.map((h,i)=><li key={`${h.at}-${i}`}><p>{h.text}</p><small>{new Date(h.at).toLocaleString('en-GB')}</small></li>)}</ol><form onSubmit={comment} className={styles.form}><label>Add an internal note<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Record a follow-up or context for the team"/></label><button className={styles.secondary} type="submit" disabled={!reason.trim()}>Add note</button></form></>}
        </div>
        {selected.approval==='Pending'&&detailTab==='Overview'&&(selected.owner===userName?<div className={styles.warning}>You submitted this request. An independent approver must review it.</div>:<form className={styles.decisionForm} onSubmit={decide}><h3>Executive decision</h3><div className={styles.decisionChoices}>{(['Approved','Clarification','Rejected'] as Approval[]).map(value=><label key={value}><input type="radio" name="decision" value={value} checked={decision===value} onChange={()=>setDecision(value)}/>{value==='Approved'?'Approve':value==='Rejected'?'Reject':'Ask for clarification'}</label>)}</div><label>Decision note <span>(required)</span><textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder={decision==='Clarification'?'What information does the requester need to provide?':'Explain your decision for the request history'}/></label><p className={styles.footnote}>This updates the demo record and dashboard totals. Payment remains {selected.payment.toLowerCase()}.</p><button className={decision==='Rejected'?styles.danger:styles.primary} disabled={!reason.trim()} type="submit">{decision==='Approved'?'Confirm approval':decision==='Rejected'?'Confirm rejection':'Request clarification'}</button></form>)}
      </>}
    </Modal>}
  </div>;
}

function NewRequest({company,companies,userName,onSave}: {company:string;companies:string[];userName:string;onSave:(row:Obligation)=>void}) {
  const [error,setError]=useState('');
  const submit=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const data=new FormData(e.currentTarget);const amount=Number(data.get('amount'))*100;
    if(!Number.isSafeInteger(Math.round(amount))||amount<=0||Math.abs(amount-Math.round(amount))>0.0001){setError('Enter a positive amount with no more than two decimal places.');return;}
    const title=String(data.get('title')).trim(), purpose=String(data.get('purpose')).trim(), deliverable=String(data.get('deliverable')).trim();
    if(!title||!purpose||!deliverable){setError('Complete the title, justification and deliverable.');return;}
    onSave({id:`DEMO-${crypto.randomUUID().slice(0,8).toUpperCase()}`,title,company:String(data.get('company')),owner:userName,amount:Math.round(amount),date:AS_OF,due:String(data.get('due')),approval:'Pending',payment:'Unpaid',closed:false,kind:String(data.get('kind')) as 'Expense'|'Advance',urgent:false,category:String(data.get('category')),purpose,deliverable,evidence:[],history:[{text:`${userName} submitted this request for independent review.`,at:new Date().toISOString()}]});
  };
  return <form className={styles.form} onSubmit={submit}><p className={styles.muted}>Create a sample request to explore the frontend flow. You cannot approve your own request.</p><label>Company<select name="company" defaultValue={company}>{companies.map(c=><option key={c}>{c}</option>)}</select></label><label>Request title<input name="title" required maxLength={120} placeholder="What needs funding?"/></label><div className={styles.formGrid}><label>Amount (NGN)<input name="amount" type="number" min="0.01" step="0.01" max="1000000000000" required placeholder="0.00"/></label><label>Needed by<input name="due" type="date" min={AS_OF} defaultValue="2026-10-22" required/></label><label>Request type<select name="kind"><option>Expense</option><option>Advance</option></select></label><label>Category<select name="category"><option>Technology</option><option>Operations</option><option>Administration</option><option>Travel</option><option>Marketing</option></select></label></div><label>Business justification<textarea name="purpose" required maxLength={1000} placeholder="Explain why this expenditure is needed"/></label><label>Expected deliverable<textarea name="deliverable" required maxLength={500} placeholder="What evidence will demonstrate completion?"/></label>{error&&<p role="alert" className={styles.warning}>{error}</p>}<button type="submit" className={styles.primary}>Submit demo request <ArrowUpRight size={16}/></button></form>;
}
