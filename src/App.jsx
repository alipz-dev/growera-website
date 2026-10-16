import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Gem, ShieldCheck, Sparkles, LockKeyhole, UserRound, LogOut, Trophy, Zap, ChevronRight } from 'lucide-react';
import ProfileCard from './components/ProfileCard.jsx';
import { demoPlayer } from './data/demoPlayer.js';
import './styles/app.css';

function Brand(){return <div className="brand"><div className="brand-icon"><Gem size={22}/></div><div><b>GROWERA</b><small>CRYSTAL ERA</small></div></div>}

function Login({onLogin}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[error,setError]=useState('');
 function submit(e){e.preventDefault();if(!username.trim()||!password){setError('Masukkan username dan password untuk melanjutkan.');return}setError('');onLogin(username.trim())}
 return <main className="shell"><header className="header"><Brand/><div className="secure"><ShieldCheck size={15}/> PLAYER PORTAL</div></header>
 <section className="login-layout"><div className="hero"><div className="eyebrow"><i/> YOUR NEXT ERA BEGINS HERE</div><h1>Enter the<br/><span>Crystal Era.</span></h1>
 <p>Satu portal untuk perjalananmu. Masuk, lihat progres, dan bersiap menjelajahi dunia GROWERA.</p>
 <div className="feature"><div><Gem size={19}/></div><section><b>Your world. Your legacy.</b><small>Semua progres pemain dalam satu tempat.</small></section></div>
 <div className="crystal-art"><div className="ring ring-a"/><div className="ring ring-b"/><Gem size={67}/><span>✦</span></div></div>
 <section className="login-card"><div className="card-top"><span>WELCOME BACK</span><Sparkles size={16}/></div><h2>Sign in</h2><p>Masuk ke akun pemain GROWERA kamu.</p>
 <form onSubmit={submit}><label htmlFor="username">USERNAME</label><div className="input"><UserRound size={17}/><input id="username" autoComplete="username" placeholder="Masukkan username" value={username} onChange={e=>setUsername(e.target.value)}/></div>
 <label htmlFor="password">PASSWORD</label><div className="input"><LockKeyhole size={17}/><input id="password" autoComplete="current-password" type={show?'text':'password'} placeholder="Masukkan password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="eye" aria-label="Tampilkan/sembunyikan password" onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
 {error&&<div className="error" role="alert">{error}</div>}<button className="submit" type="submit">SIGN IN <ArrowRight size={17}/></button></form>
 <div className="demo-note"><Sparkles size={14}/> Demo UI: isi username dan password apa saja untuk membuka preview.</div><div className="card-footer"><span><ShieldCheck size={13}/> Crystal Era Player Portal</span><span>v0.1.0</span></div></section></section>
 <footer className="footer"><span>© 2026 GROWERA</span><span>CRAFTED FOR THE CRYSTAL ERA</span></footer></main>
}

function Dashboard({player,onLogout}){
 const xpPercent=Math.min(100,player.xp/player.xpTarget*100);
 return <main className="shell"><header className="header"><Brand/><div className="header-actions"><span className="preview"><i/> DEMO PREVIEW</span><button className="logout" onClick={onLogout}><LogOut size={15}/> <span>Sign out</span></button></div></header>
 <section className="dashboard"><div className="welcome"><div><div className="eyebrow"><i/> PLAYER SPACE</div><h1>Your journey,<br className="mobile-break"/> <span>crystallized.</span></h1><p>Selamat datang kembali. Ini adalah preview identitas pemainmu.</p></div><div className="welcome-gem"><Gem size={29}/></div></div>
 <div className="profile-grid"><ProfileCard player={player}/><div className="side">
 <section className="panel"><div className="panel-heading"><div><small>PLAYER PROGRESS</small><h2>Level journey</h2></div><Zap className="cyan"/></div>
 <div className="level"><strong>{player.level}</strong><span>LEVEL</span><label>NEXT <b>{player.level+1}</b></label></div><div className="xp-meta"><span>EXPERIENCE</span><b>{player.xp.toLocaleString('id-ID')} / {player.xpTarget.toLocaleString('id-ID')} XP</b></div><div className="xp-track"><i style={{width:xpPercent+'%'}}/></div><p className="muted">{Math.max(0,player.xpTarget-player.xp).toLocaleString('id-ID')} XP lagi menuju level berikutnya.</p></section>
 <section className="panel wallet"><div className="wallet-icon"><Gem size={22}/></div><div><small>CRYSTAL WALLET</small><h2>{player.gems.toLocaleString('id-ID')} <span>Gems</span></h2><p>Saldo kristal pemain</p></div></section>
 <section className="panel quick"><div className="panel-heading"><div><small>YOUR PORTAL</small><h2>Quick access</h2></div></div>
 <button onClick={()=>alert('Profile Preview — fitur demo.')}><span className="quick-icon"><UserRound size={17}/></span><span><b>My profile</b><small>Identitas pemain</small></span><ChevronRight size={16}/></button>
 <button onClick={()=>alert('Rewards akan dibuat pada tahap berikutnya.')}><span className="quick-icon"><Trophy size={17}/></span><span><b>Rewards</b><small>Hadiah dan pencapaian</small></span><ChevronRight size={16}/></button></section></div></div>
 <div className="disclaimer"><Sparkles size={15}/> Prototype UI: data profil masih dummy dan login belum terhubung ke server/API.</div></section>
 <footer className="footer"><span>© 2026 GROWERA</span><span>CRYSTAL ERA · PLAYER PORTAL</span></footer></main>
}
export default function App(){const [player,setPlayer]=useState(null);return player?<Dashboard player={player} onLogout={()=>setPlayer(null)}/>:<Login onLogin={username=>setPlayer({...demoPlayer,username})}/>;}
