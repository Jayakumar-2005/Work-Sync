const LS = {
  users: "tt.users",
  session: "tt.session",
  tasks: "tt.tasks",
  seed: "tt.seed"
};

const el = id => document.getElementById(id); 
const tpl = id => document.getElementById(id).content.cloneNode(true);
const uid = () => Math.random().toString(36).slice(2, 9); 
const now = () => new Date().toISOString();

// localStorage read and write
const read = (k, f) => {
  try {
    const x = localStorage.getItem(k);
    return x ? JSON.parse(x) : f
  } catch {
    return f
  }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// seeding default data
function seed() {
  if(read(LS.seed,false)) return; 
  const u = [
    {id:uid(),name:"Wesnesday",email:"wednes1@demo.dev",password:"demo"},
    {id:uid(),name:"Eleven",email:"eleven@demo.dev",password:"demo"},
    {id:uid(),name:"steev",email:"steev@demo.dev",password:"demo"},
  ];

  write(LS.users,u);

  write(LS.tasks,[
    {
      id:uid(), title:"Set up repo & CI",
      description:"Init repo, branch rules, CI.",
      status:"Pending",
      assigneeId:u[0].id,
      dueDate:new Date(Date.now()+36*3600e3).toISOString(),
      priority:"High",
      createdAt:now()
    },
    {
      id:uid(),
      title:"Design API schema",
      description:"Task/User/Notif models",
      status:"In Progress",
      assigneeId:u[1].id,
      dueDate:new Date(Date.now()+3*86400e3).toISOString(),
      priority:"Medium",
      createdAt:now()
    },
    {
      id:uid(),
      title:"Responsive polish",
      description:"Tweak gaps & breakpoints",
      status:"Completed",
      assigneeId:u[2].id,
      dueDate:new Date(Date.now()-86400e3).toISOString(),
      priority:"Low",
      createdAt:now()
    },
  ]);
  write(LS.seed,true);
}

function app(){ 
  seed(); 
  const session = read(LS.session,null);
  if(!session) return renderAuth();
  else return renderApp();
}

// Authentication Screen
function renderAuth(){ 
  const root = el('app'); 
  root.innerHTML=''; 
  root.append(tpl('tpl-auth'));

  const f = el('authForm'), mode = el('mode'), nameWrap = el('nameWrap'); 
  mode.onchange = () => nameWrap.style.display = mode.value==='signup'?'grid':'none';

  f.onsubmit = (e) => {
    e.preventDefault(); 
    const email = el('email').value.trim();
    const pwd = el('pwd').value; 
    const name = el('name').value.trim(); 
    let users = read(LS.users,[]);

    if(mode.value==='signup'){
      if(users.some(u=>u.email===email)) return alert('Email already used');
      const u = {id:uid(), name, email, password:pwd}; 
      users=[...users,u]; 
      write(LS.users,users); 
      write(LS.session,{userId:u.id});
    } else {
      const u = users.find(u=>u.email===email && u.password===pwd); 
      if(!u) return alert('Invalid credentials'); 
      write(LS.session,{userId:u.id});
    }
    renderApp();
  };
}

// Update task statuses (Pending, In Progress, Completed, Overdue)
function updateTaskStatuses() {
  let tasks = read(LS.tasks, []);
  let currentDate = new Date().setHours(0,0,0,0);

  tasks = tasks.map(task => {
    if(task.status === "Completed") return task;

    if(task.dueDate){
      let dueDate = new Date(task.dueDate).setHours(0,0,0,0);
      if(currentDate > dueDate) return { ...task, status: "Overdue" };
    }
    return task;
  });

  write(LS.tasks, tasks);
}

function renderApp(){ 
  const root = el('app'); 
  root.innerHTML=''; 
  root.append(tpl('tpl-app'));

  const users = read(LS.users,[]); 
  const session = read(LS.session,null); 
  const me = users.find(u=>u.id===session.userId);
  el('who').textContent = `${me.name} • ${me.email}`;

  el('btnLogout').onclick = () => {
    localStorage.removeItem(LS.session); 
    app();
  };

  // Assignee filter
  const flt = el('fltAssignee'); 
  flt.innerHTML = ''; 
  const optAll = new Option('All','all'); 
  const optUn = new Option('Unassigned','un'); 
  flt.add(optAll); 
  flt.add(optUn);
  users.forEach(u => flt.add(new Option(u.name,u.id)));

  // Notification permission
  el('btnNotify').onclick = async()=>{ 
    if(!('Notification' in window)) return alert('Notifications not supported'); 
    try{ await Notification.requestPermission() } catch{}
  };

  // Task dialog setup
  const dlg = el('taskDlg'), form = el('taskForm'); 
  let editing = null;
  const assignSel = el('fAssign'); 
  assignSel.innerHTML = '<option value="">Unassigned</option>'+users.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');

  el('btnNew').onclick = () => {
    editing = null; 
    el('dlgTitle').textContent='New Task'; 
    form.reset(); dlg.showModal()
  };

  form.onsubmit = (e) => {
    e.preventDefault(); 
    const payload = {
      title: el('fTitle').value.trim(), 
      description: el('fDesc').value.trim(), 
      assigneeId: assignSel.value||null,
      dueDate: el('fDue').value?new Date(el('fDue').value).toISOString():null, 
      priority: el('fPrio').value, 
      status: el('fStat').value
    };

    let tasks = read(LS.tasks,[]);
    if(editing){ 
      tasks = tasks.map(t=>t.id===editing?{...t,...payload}:t) 
    } else { 
      tasks = [{ id:uid(), createdAt:now(), ...payload }, ...tasks] 
    }
    write(LS.tasks, tasks); 
    dlg.close(); 
    updateTaskStatuses(); // update overdue before rendering
    renderList();
  };

  // Render board
  function renderList(){ 
    updateTaskStatuses(); // mark overdue tasks
    const tasks = decorate(read(LS.tasks,[]),users);
    const ass = flt.value; 
    const fTasks = tasks.filter(t=> ass==='all' ? true : ass==='un'? !t.assigneeId : t.assigneeId===ass );
    const pend = fTasks.filter(t=>t.status==='Pending'); 
    const prog = fTasks.filter(t=>t.status==='In Progress'); 
    const done = fTasks.filter(t=>t.status==='Completed'); 
    const over = fTasks.filter(t=>t.status==='Overdue');
    draw('listPend',pend); 
    draw('listProg',prog); 
    draw('listDone',done);
    draw('listOver',over); // optional container for overdue tasks
    el('cPend').textContent=pend.length; 
    el('cProg').textContent=prog.length; 
    el('cDone').textContent=done.length;
  }

  flt.onchange = renderList; 
  renderList();

  // Reminders (check each minute)
  setInterval(()=>checkReminders(),60*1000); 
  checkReminders();
  function checkReminders(){ 
    const tasks = read(LS.tasks,[]); 
    const nowMs = Date.now(), soon = 24*3600e3;
    tasks.forEach(t => { 
      if(!t.dueDate || t.status==='Completed') return; 
      const due = new Date(t.dueDate).getTime();
      if(isNaN(due)) return; 
      const overdue = due < nowMs, dueSoon = due - nowMs > 0 && due - nowMs <= soon;
      if(overdue) toast(`Overdue: ${t.title}`);
      else if(dueSoon) toast(`Due within 24h: ${t.title}`);
      if(Notification?.permission==='granted' && (overdue || dueSoon)) 
        try{
          new Notification(overdue?`Overdue: ${t.title}`:`Due soon: ${t.title}`)
        }catch{}
    })
  }

  function draw(listId, arr){ 
    const host = el(listId); 
    host.innerHTML = ''; 
    arr.sort((a,b)=>new Date(a.dueDate||'2100')-new Date(b.dueDate||'2100'));
    arr.forEach(t => { 
      const d = document.createElement('div'); 
      d.className = 'card';
      d.innerHTML = `<div class=row><b>${escapeHTML(t.title)}</b><span class="pill right">${escapeHTML(t.priority)}</span></div>
        <div class=mut>${escapeHTML(t.description||'')}</div>
        <div class=row>
          <span class=pill>${escapeHTML(t.assigneeName||'Unassigned')}</span>
          ${t.dueDate?`<span class=pill>🕒 ${new Date(t.dueDate).toLocaleString()}</span>`:''}
          <span class="grow"></span>
          <select data-act="status" data-id="${t.id}" class="btn btn-status">
            ${['Pending','In Progress','Completed','Overdue'].map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}
          </select>
          <button class="btn btn-edit" data-act="edit" data-id="${t.id}">✎</button>
          <button class="btn btn-delete" data-act="del" data-id="${t.id}">Delete</button>
        </div>`;
      host.append(d);
    });
    host.querySelectorAll('[data-act]').forEach(b=>b.onclick=handleAction);
  }

  function handleAction(e){ 
    const id = e.currentTarget.dataset.id, act = e.currentTarget.dataset.act; 
    let tasks = read(LS.tasks,[]);
    if(act==='del'){ 
      if(confirm('Delete this task?')){ 
        tasks = tasks.filter(t=>t.id!==id); 
        write(LS.tasks,tasks); 
        renderList(); 
      } 
      return; 
    }

    if(act==='status'){ 
      const val = e.currentTarget.value; 
      tasks = tasks.map(t=>t.id===id?{...t,status:val}:t); 
      write(LS.tasks,tasks); 
      renderList(); 
      return; 
    }

    if(act==='edit'){ 
      const t = read(LS.tasks,[]).find(x=>x.id===id); 
      editing = id; 
      el('dlgTitle').textContent='Edit Task';
      el('fTitle').value = t.title||''; 
      el('fDesc').value = t.description||''; 
      el('fAssign').value = t.assigneeId||''; 
      el('fPrio').value = t.priority||'Medium'; 
      el('fStat').value = t.status||'Pending';
      el('fDue').value = t.dueDate?new Date(t.dueDate).toISOString().slice(0,16):''; 
      el('taskDlg').showModal();
    }
  }
}

function decorate(tasks,users){
  return tasks.map(t => ({...t, assigneeName: users.find(u=>u.id===t.assigneeId)?.name}))
}

function toast(msg){ 
  const box = el('toasts'); 
  const item = document.createElement('div'); 
  item.className = 'item'; 
  item.textContent = msg; 
  box.append(item); 
  setTimeout(()=>item.remove(),4000) 
}

function escapeHTML(s){
  return s.replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))
}

app();
