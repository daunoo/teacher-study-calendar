(() => {
  'use strict';
  const START = '2026-11-30', END = '2027-03-05';
  const STORE = 'teacher-study-calendar-2027-v1'; // legacy key: allows migration on same origin
  const MIRROR = 'teacher-calendar-ios-backup-v1';
  const $ = id => document.getElementById(id);
  const toDate = iso => new Date(Number(iso.slice(0,4)), Number(iso.slice(5,7))-1, Number(iso.slice(8,10)),12);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const range = (from,to) => {const days=[];for(let d=toDate(from);d<=toDate(to);d.setDate(d.getDate()+1))days.push(fmt(d));return days;};
  const DAYS=range(START,END);
  const REST=new Set(['2026-12-05','2026-12-06','2026-12-12','2026-12-13','2026-12-19','2026-12-20','2026-12-24','2026-12-26','2026-12-27','2027-01-01','2027-01-02','2027-01-03',...range('2027-01-11','2027-01-15'),'2027-01-23','2027-01-24','2027-01-27','2027-01-30','2027-01-31','2027-02-03','2027-02-06','2027-02-07','2027-02-10','2027-02-13','2027-02-14','2027-02-21','2027-02-25','2027-02-26']);
  function defaults(){return Object.fromEntries(DAYS.map(day => [day, {status:REST.has(day)?'rest':'learn',hours:0,note:day==='2027-01-01'?'元旦连休':day==='2027-01-11'?'五天旅行开始':day==='2027-01-15'?'五天旅行结束':day==='2027-02-26'?'考前休息一天':''}]));}
  const stage = day => day <='2027-01-10' ? 'p1' : day <='2027-02-25' ? 'p2' : day==='2027-02-26'?'bridge':'p3';
  let days=defaults(), selected=null, status='learn', draft=[], editing=-1;let toastTimer;
  const SUBJECTS={s1:'科一',s2:'科二',s3:'科三'};
  const minuteText=n=>`${Number(n.toFixed(2))}分`;
  const totalMinutes=item=>(item.legacyHours ?? item.hours ?? 0)*60+(item.records||[]).reduce((sum,r)=>sum+r.minutes,0);
  function planFor(key,override){
    let serial=0;
    for(const d of DAYS){const s=d===key&&override?override:days[d].status;if(s==='learn')serial++;if(d===key){if(s==='rest')return {s1:0,s2:0,s3:0,total:0,serial:0};break;}}
    const p=serial<=30?{s1:45,s2:75,s3:30}:serial<=58?{s1:80,s2:130,s3:60}:serial<=65?{s1:120,s2:210,s3:90}:{s1:0,s2:0,s3:0};
    return {...p,total:p.s1+p.s2+p.s3,serial};
  }
  function progressBar(actual,planned,label){const bar=document.createElement('progress');bar.max=100;bar.value=planned?Math.min(100,actual/planned*100):0;bar.setAttribute('aria-label',label);bar.setAttribute('aria-valuetext',planned?`${Math.round(actual/planned*100)}%`:'无预设计划');return bar;}
  function renderEditor(){
    if(!selected)return;
    const plan=planFor(selected,status),legacy=Number($('hoursInput').value||0)*60;
    const actual={s1:0,s2:0,s3:0};for(const r of draft)actual[r.subject]+=r.minutes;
    const target=$('dayProgress');target.replaceChildren();
    const intro=document.createElement('div');intro.className='muted';intro.textContent=plan.serial?`DAY ${plan.serial} · ${plan.total?`计划 ${plan.total}分钟（${plan.total/60}小时）`:'超过DAY65，暂无预设计划'}`:'休息日 · 计划0分钟，可记录实际学习';target.append(intro);
    for(const s of ['s1','s2','s3','total']){
      const a=s==='total'?actual.s1+actual.s2+actual.s3+(Number.isFinite(legacy)?legacy:0):actual[s];
      const line=document.createElement('div');line.className='progress-line';line.textContent=`${s==='total'?'当天合计':SUBJECTS[s]} · 计划 ${minuteText(plan[s])} · 实际 ${minuteText(a)} · ${plan[s]?`${Math.round(a/plan[s]*100)}%`:'无预设计划'}`;target.append(line,progressBar(a,plan[s],s==='total'?'当天总进度':SUBJECTS[s]+'完成进度'));
    }
    if(legacy>0){const hint=document.createElement('div');hint.className='tiny';hint.textContent=`合计包含旧记录未分科时长 ${minuteText(legacy)}；各科进度仅统计分科记录。`;target.append(hint);}
    const list=$('recordList');list.replaceChildren();
    draft.forEach((r,i)=>{const row=document.createElement('div');row.className='record';const text=document.createElement('div');text.className='record-text';text.textContent=`${SUBJECTS[r.subject]} · ${r.minutes}分钟\n${r.content}`;const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='编辑';edit.onclick=()=>showRecord(i);const del=document.createElement('button');del.type='button';del.className='btn';del.textContent='删除';del.onclick=()=>{draft.splice(i,1);$('recordForm').classList.add('hidden');editing=-1;renderEditor();};row.append(text,edit,del);list.append(row);});
    if(!draft.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='尚无分科记录，点击下方添加。';list.append(empty);}
  }
  function showRecord(index=-1){
    if(!$('recordForm').classList.contains('hidden')){notice('请先加入或取消正在填写的记录');return;}
    editing=index;const r=draft[index];$('subjectInput').value=r?.subject||'s1';$('contentInput').value=r?.content||'';$('minutesInput').value=r?.minutes||'';$('recordForm').classList.remove('hidden');$('contentInput').focus();
  }
  $('addRecord').onclick=()=>showRecord();
  $('cancelRecord').onclick=()=>{$('recordForm').classList.add('hidden');editing=-1;};
  $('hoursInput').oninput=()=>renderEditor();
  $('recordForm').onsubmit=e=>{
    e.preventDefault();const subject=$('subjectInput').value,content=$('contentInput').value.trim(),minutes=Number($('minutesInput').value);
    if(!Object.hasOwn(SUBJECTS,subject)||!content||content.length>3000||!Number.isInteger(minutes)||minutes<=0||minutes>1440){notice('请填写科目、具体内容和1至1440的整数分钟');return;}
    const next=draft.map(r=>({...r}));const r={subject,content,minutes};if(editing>=0)next[editing]=r;else next.push(r);
    const total=Number($('hoursInput').value||0)*60+next.reduce((sum,x)=>sum+x.minutes,0);if(!Number.isFinite(total)||total<0||total>1440){notice('当天实际总时长不能超过24小时');return;}
    draft=next;editing=-1;$('recordForm').classList.add('hidden');renderEditor();
  };

  function notice(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2700);}
  function clean(input){
    if(!input || typeof input!=='object' || Array.isArray(input))return null;
    const result=defaults();let valid=0;
    for(const key of DAYS){
      if(!Object.hasOwn(input,key))continue;
      const x=input[key];if(!x||!['learn','rest'].includes(x.status))return null;
      const h=Number(x.hours ?? 0);if(!Number.isFinite(h)||h<0||h>24)return null;
      let records=[],legacyHours=h;
      if(Object.hasOwn(x,'records')){
        if(!Array.isArray(x.records)||!Number.isFinite(x.legacyHours)||x.legacyHours<0||x.legacyHours>24)return null;
        legacyHours=x.legacyHours;
        for(const r of x.records){
          if(!r||!Object.hasOwn(SUBJECTS,r.subject)||typeof r.content!=='string'||!r.content.trim()||r.content.length>3000||!Number.isInteger(r.minutes)||r.minutes<=0||r.minutes>1440)return null;
          records.push({subject:r.subject,content:r.content,minutes:r.minutes});
        }
      }
      const hours=legacyHours+records.reduce((sum,r)=>sum+r.minutes,0)/60;
      if(hours>24)return null;
      if(typeof x.note!=='undefined' && (typeof x.note!=='string'||x.note.length>3000))return null;
      result[key]={status:x.status,hours,legacyHours,records,note:x.note||''};valid++;
    }
    return valid?result:null;
  }
  let storageBlocked=false;
  function readStore(){let latest=null,at='';for(const k of [STORE,MIRROR]){try{const val=localStorage.getItem(k);if(!val)continue;const parsed=JSON.parse(val);if(parsed.version && ![1,2].includes(parsed.version)){storageBlocked=true;continue;}const d=clean(parsed.days);if(!d){storageBlocked=true;continue;}const timestamp=String(parsed.updatedAt||'');if(!latest||timestamp>at){latest=d;at=timestamp;}}catch(e){storageBlocked=true;}}if(latest)days=latest;}
  let canStore=true;
  function persist(){if(storageBlocked){notice('发现无法读取的旧数据，已停止写入保护原数据；请先导出当前可读记录。');return false;}const payload=JSON.stringify({version:2,updatedAt:new Date().toISOString(),days});let count=0;for(const k of [STORE,MIRROR]){try{localStorage.setItem(k,payload);if(localStorage.getItem(k)===payload)count++;}catch(e){}}canStore=count>0;$('storageNote').textContent=canStore?'✓ 本机保存成功 · 建议每周导出备份':'⚠ 当前环境无法自动保存，请立即使用「备份到文件」';$('storageNote').classList.toggle('warn',!canStore);return canStore;}
  let lunarFormatter;try{lunarFormatter=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{month:'long',day:'numeric'});}catch(e){lunarFormatter=null;}
  function lunar(iso){if(!lunarFormatter)return '农历';try{const parts=lunarFormatter.formatToParts(toDate(iso));const mn=parts.find(x=>x.type==='month')?.value||'';const dn=Number(parts.find(x=>x.type==='day')?.value);const names=['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];return dn===1?mn:(names[dn-1]||mn);}catch(e){return '农历';}}
  function stats(){let learn=0,rest=0,hours=0,records=0;for(const k of DAYS){const item=days[k];if(item.status==='learn')learn++;else rest++;hours+=item.hours;if(item.hours>0)records++;}return {learn,rest,hours,records};}
  function render(){const tally=stats();$('total').textContent=DAYS.length;$('learning').textContent=tally.learn;$('resting').textContent=tally.rest;$('hours').textContent=Number(tally.hours.toFixed(2)).toString();$('hourDays').textContent=`${tally.records}天已有小时记录`;$('split').textContent=`学习${tally.learn}天 / 休息${tally.rest}天`;$('studyBar').style.width=`${100*tally.learn/DAYS.length}%`;$('restBar').style.width=`${100*tally.rest/DAYS.length}%`;
    let count=0;const serial={};for(const d of DAYS){if(days[d].status==='learn')serial[d]=++count;}
    const today=fmt(new Date());const target=$('calendar');target.replaceChildren();
    for(const ym of ['2026-11','2026-12','2027-01','2027-02','2027-03']){const year=Number(ym.slice(0,4)),month=Number(ym.slice(5));const article=document.createElement('section');article.className='month';const title=document.createElement('div');title.className='month-head';title.innerHTML=`<span class="month-title">${year}年 ${month}月</span><span class="month-desc">${year===2026?'基础阶段':month===3?'冲刺阶段':'学习日历'}</span>`;article.append(title);const week=document.createElement('div');week.className='week';for(const w of ['一','二','三','四','五','六','日']){const s=document.createElement('span');s.textContent=w;week.append(s);}article.append(week);
      const grid=document.createElement('div');grid.className='cells';const first=(new Date(year,month-1,1).getDay()+6)%7;for(let n=0;n<first;n++){const e=document.createElement('div');e.className='empty';grid.append(e);}const max=new Date(year,month,0).getDate();for(let n=1;n<=max;n++){const key=`${ym}-${String(n).padStart(2,'0')}`;const b=document.createElement('button');b.type='button';b.className='day';if(key<START||key>END){b.disabled=true;b.innerHTML=`<span class="num">${n}</span>`;}else{const x=days[key];b.classList.add(stage(key));if(x.status==='rest')b.classList.add('rest');if(key===today)b.classList.add('today');const num=document.createElement('span');num.className='num';num.textContent=n;b.append(num);const lunarSpan=document.createElement('span');lunarSpan.className='lunar';lunarSpan.textContent=lunar(key);b.append(lunarSpan);const badge=document.createElement('span');badge.className='state';badge.textContent=x.status==='learn'?'学':'休';b.append(badge);const bottom=document.createElement('div');bottom.className='bottom';const time=document.createElement('span');time.textContent=x.hours>0?`${Number(x.hours.toFixed(2))}h`:'';const note=document.createElement('span');note.className='flags';note.textContent=x.note?'✎':'';bottom.append(time,note);b.append(bottom);const sn=document.createElement('span');sn.className='serial';sn.textContent=x.status==='learn'?`DAY ${serial[key]}`:'';b.append(sn);const plan=planFor(key);const actual=totalMinutes(x);const summary=document.createElement('span');summary.className='daily-time';summary.textContent=`实${minuteText(actual)} / 计${minuteText(plan.total)}`;b.append(summary);b.dataset.date=key;b.setAttribute('aria-label',`${key} ${x.status==='learn'?'学习':'休息'} ${sn.textContent} 实际${minuteText(actual)} 计划${minuteText(plan.total)}，添加或编辑记录`);b.append(progressBar(actual,plan.total,'当天总进度'));const add=document.createElement('span');add.className='add-label';add.textContent='＋添加';add.addEventListener('click',event=>{event.stopPropagation();openEditor(key);showRecord();});b.append(add);b.title=`${key} · ${x.status==='learn'?'学习':'休息'} · ${x.hours}小时 · ${x.note||'暂无备注'}`;b.addEventListener('click',()=>openEditor(key));}grid.append(b);}article.append(grid);target.append(article);}}
  function chosen(){for(const [id,s] of [['learnBtn','learn'],['restBtn','rest']]){$(id).classList.toggle('chosen',status===s);$(''+id).setAttribute('aria-pressed',String(status===s));}}
  function openEditor(key){selected=key;const d=toDate(key);const wd=['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];$('editTitle').textContent=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;$('editSubtitle').textContent=`${wd} · 农历${lunar(key)} · ${stage(key)==='p1'?'基础期':stage(key)==='p2'?'强化期':stage(key)==='p3'?'冲刺期':'考前休息'}`;status=days[key].status;draft=(days[key].records||[]).map(r=>({...r}));editing=-1;$('recordForm').classList.add('hidden');const legacy=days[key].legacyHours ?? days[key].hours;$('hoursInput').value=String(legacy||0);$('legacyField').classList.toggle('hidden',!legacy);$('noteInput').value=days[key].note;chosen();renderEditor();$('overlay').classList.add('open');$('close').focus();}
  function closeEditor(){$('overlay').classList.remove('open');selected=null;}
  $('learnBtn').onclick=()=>{status='learn';chosen();renderEditor();};$('restBtn').onclick=()=>{status='rest';chosen();renderEditor();};$('close').onclick=closeEditor;$('cancel').onclick=closeEditor;$('overlay').addEventListener('click',event=>{if(event.target===$('overlay'))closeEditor();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEditor();});
  $('save').onclick=()=>{
    if(!selected)return;
    if(!$('recordForm').classList.contains('hidden')){notice('请先“加入当天”或取消正在填写的记录');return;}
    const legacyHours=Number($('hoursInput').value||0);
    const hours=legacyHours+draft.reduce((sum,r)=>sum+r.minutes,0)/60;
    if(!Number.isFinite(legacyHours)||legacyHours<0||hours>24){notice('当天实际总时长须在0至24小时内');return;}
    if(storageBlocked){notice('原数据暂无法完整读取，已保护原数据，未保存。');return;}
    const previous=days[selected];days[selected]={...previous,status,hours,legacyHours,records:draft.map(r=>({...r})),note:$('noteInput').value.slice(0,3000)};
    if(!persist()){days[selected]=previous;notice('保存失败，请保持窗口打开并重试');return;}
    render();closeEditor();notice('已保存今天的安排');
  };
  function backupData(){return {app:'教资65天学习日历',version:2,range:[START,END],updatedAt:new Date().toISOString(),days};}
  function backupFile(){const dateTime=new Date().toISOString().slice(0,23).replace(/[:T.]/g,'-');return new File([JSON.stringify(backupData(),null,2)],`教资日历备份_${dateTime}.json`,{type:'application/json'});}
  function download(file){const u=URL.createObjectURL(file);const a=document.createElement('a');a.href=u;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),15000);}
  $('export').onclick=()=>{download(backupFile());notice('已生成备份，请在“文件”App中妥善保存');};
  $('share').onclick=async()=>{try{const file=backupFile();if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'教资日历备份'});notice('已打开系统分享菜单');}else{download(file);notice('当前系统不支持分享文件，已改为下载');}}catch(err){if(err.name!=='AbortError')notice('分享失败，请使用「备份到文件」');}};
  $('import').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed.days||typeof parsed.days!=='object')throw Error('文件格式不正确');if(parsed.version && ![1,2].includes(parsed.version))throw Error('此备份版本暂不支持，原数据未更改');const newData=clean(parsed.days);if(!newData)throw Error('没有有效的日期记录');if(storageBlocked)throw Error('本机有无法读取的数据，已停止恢复以保护原数据');if(!confirm('恢复会替换当前日历；继续前会自动下载当前备份并保留一份本机快照。确定恢复吗？'))return;const previous=days;localStorage.setItem(STORE+'-before-restore-'+Date.now(),JSON.stringify(backupData()));download(backupFile());days=newData;if(!persist()){days=previous;throw Error('无法保存恢复内容，已保留当前日历');}render();notice('备份已恢复，恢复前记录已另存');}catch(err){notice(`恢复失败：${err.message}`);}finally{$('importFile').value='';}};
  readStore();render();if(storageBlocked){$('storageNote').textContent='⚠ 发现无法完整读取的本机数据，已保护原数据并暂停写入，请先备份。';$('storageNote').classList.add('warn');}
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});}
})();
