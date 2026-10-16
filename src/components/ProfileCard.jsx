import { BadgeCheck, Gem, ShieldCheck, Sparkles } from 'lucide-react';
export default function ProfileCard({ player }) {
  return <section className="profile-card">
    <div className="profile-art"><div className="art-grid"/><div className="art-orb"/><div className="art-label"><span/> CRYSTAL ERA PLAYER</div><div className="emblem"><Gem size={38}/></div></div>
    <div className="profile-body"><div className="avatar-wrap"><div className="avatar">{player.username.charAt(0).toUpperCase()}</div><i/></div>
      <div className="name-row"><div><small>PLAYER IDENTITY</small><h2>{player.username}</h2></div><BadgeCheck className="cyan"/></div>
      <div className="status"><i/> {player.status}</div><hr/>
      <div className="stats"><div><ShieldCheck/><small>PLAYER LEVEL</small><strong>{player.level}</strong></div><div><Gem/><small>GEMS BALANCE</small><strong>{player.gems.toLocaleString('id-ID')}</strong></div></div>
      <div className="card-bottom"><span><Sparkles size={14}/> A NEW ERA AWAITS</span><span>GW-{String(player.level).padStart(4,'0')}</span></div>
    </div>
  </section>;
}
