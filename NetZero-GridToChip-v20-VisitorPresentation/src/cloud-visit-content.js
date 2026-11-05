/* Cloud visit copy. Scenario results are supplied by the running model. */
(function(root,factory){
  const content=factory();
  if(typeof module==='object'&&module.exports)module.exports=content;
  if(root)root.NZ_CLOUD_CONTENT=content;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const content = {
    title:'云参观',
    eyebrow:'CLOUD VISIT · CAMPUS COLLABORATION',
    intro:'跟随镜头认识园区，或从一个具体变化出发，看看各园区如何共同应对。',
    tabs:{tour:'园区导览',scenarios:'情境演示'},
    tour:{
      title:'完整园区导览｜从能源到算力',
      summary:'从全景认识园区，沿风光发电、架空线路与能源枢纽，进入数据中心、工业园区和新能源超充站，了解西比里的关键节点装备。',
      action:'开始园区导览',
      note:'可暂停、继续或随时结束，返回自由浏览。'
    },
    stages:[
      {id:'forecast',title:'预测',description:'先看接下来可能发生什么。'},
      {id:'feedback',title:'反馈',description:'各园区反馈自己的状态与调节空间。'},
      {id:'proposal',title:'方案',description:'提出可以共同执行的调节方案。'},
      {id:'check',title:'校核',description:'检查供电、储能与业务边界。'},
      {id:'execute',title:'执行',description:'观察设备、负荷与流向如何变化。'},
      {id:'review',title:'复盘',description:'将结果与本次目标放在一起看。'}
    ],
    agents:[
      {id:'forecast',name:'风光预测',role:'识别风光出力变化，给出接下来的供需信号。',short:'看见变化'},
      {id:'coordinator',name:'能源协调',role:'汇总园区需求，在共同约束下形成调节方案。',short:'协调全局'},
      {id:'storage',name:'储能',role:'反馈可用电量、充放电空间和备用边界。',short:'守住余量'},
      {id:'compute',name:'算电协同',role:'区分即时服务与可延期任务，安排适合的执行时段。',short:'安排算力'},
      {id:'industry',name:'柔性用能',role:'反馈工业负荷的调节能力，兼顾生产连续性。',short:'反馈柔性'}
    ],
    scenarios:[
      {
        id:'coordination',number:'01',title:'风光变化，园区如何协同',
        summary:'风光出力发生变化时，储能、数据中心与工业负荷一起回应。',
        goal:'看清谁先响应、为什么这样分配，以及调节之后留下什么影响。',
        action:'进入协同情境',tag:'多园区协同',
        steps:[
          {id:'forecast',title:'风光变化被提前看见',agent:'forecast',text:'预测环节给出风光出力变化和可能出现的供需缺口，园区开始提前准备。'},
          {id:'feedback',title:'每个园区反馈自己的边界',agent:'coordinator',text:'储能反馈可用电量，数据中心说明服务需求，工业负荷提供可调节空间。'},
          {id:'proposal',title:'形成一份协同方案',agent:'coordinator',text:'比较储能支撑、任务安排和柔性用能，优先保障关键负荷，再分配可调节部分。'},
          {id:'check',title:'方案先过边界检查',agent:'storage',text:'检查储能余量、功率范围和负荷约束，避免把不能调的部分也当作可用资源。'},
          {id:'execute',title:'从指令到设备响应',agent:'industry',text:'调节方案落实到各园区。电力流展示供电变化，控制流展示指令与回执。'},
          {id:'review',title:'回看这一次协同',agent:'coordinator',text:'查看本次购电、弃电、储能与任务完成情况，理解调节带来的收益和代价。'}
        ],
        boundary:'化工与制造的调节采用情境设定的边界，不表示所有生产装置都可随时启停。'
      },
      {
        id:'green-compute',number:'02',title:'算力如何跟随绿电',
        summary:'即时服务保持优先，让可延期任务在更合适的能源时段完成。',
        goal:'展示任务何时执行、用多少电，以及尚未完成的任务如何被保留。',
        action:'进入算电情境',tag:'任务与绿电匹配',
        steps:[
          {id:'forecast',title:'寻找适合执行任务的时段',agent:'forecast',text:'将风光变化与算力需求放到同一条时间线上，观察能源富余和紧张的时段。'},
          {id:'feedback',title:'分清即时服务和可延期任务',agent:'compute',text:'即时服务优先保障；可延期任务进入待执行队列，明确完成要求与可调节空间。'},
          {id:'proposal',title:'把可延期任务安排到合适时段',agent:'compute',text:'在供电和业务边界内安排任务执行，绿电富余时多完成一些，紧张时适度延后。'},
          {id:'check',title:'核对供电和任务完成边界',agent:'coordinator',text:'检查IT负荷、储能支撑和待完成工作量，避免用少做任务来表现更好的能源指标。'},
          {id:'execute',title:'算力负荷随安排变化',agent:'compute',text:'观察数据中心用电和任务队列的变化。延期任务持续记账，不因暂停执行而消失。'},
          {id:'review',title:'同时看能源和服务结果',agent:'coordinator',text:'把用电结果、等效任务完成量与待完成工作量放在一起，理解算电协同的实际取舍。'}
        ],
        boundary:'任务与Token产出为情境估算；不代表真实订单、实际并发能力或已成交服务。'
      },
      {
        id:'strategy',number:'03',title:'不同策略，会有什么结果',
        summary:'先看资源具备时如何保障交付，再看资源受限时的调度边界。每个工况内部公平比较两种策略。',
        goal:'把能源利用、供电保障和任务交付放在同一张结果表里比较。',
        action:'进入策略对比',tag:'同条件比较',
        steps:[
          {id:'forecast',title:'采用同一组外部条件',agent:'forecast',text:'为待比较策略使用相同的风光变化、负荷需求和初始储能状态。'},
          {id:'feedback',title:'明确哪些条件保持一致',agent:'coordinator',text:'各策略面对相同的任务需求和设备边界，比较过程中不额外增加容量。'},
          {id:'proposal',title:'选择不同的运行思路',agent:'coordinator',text:'一侧按基准方式运行，另一侧利用可用的储能和负荷调节空间，形成不同安排。'},
          {id:'check',title:'比较前先检查口径',agent:'storage',text:'同时核对储能末态和待完成任务，避免把透支电量或延后交付误当作无代价收益。'},
          {id:'execute',title:'让两种策略各自运行',agent:'coordinator',text:'在同一情境下计算两种策略的过程，观察购电、弃电、负荷和任务队列变化。'},
          {id:'review',title:'结果和代价一并呈现',agent:'coordinator',text:'并列展示两种策略的结果、差值与边界状态，说明优势出现在哪些条件下。'}
        ],
        boundary:'对比结果来自相同起点和条件下的本次情境计算，不代表已验证的实际项目收益。'
      }
    ],
    labels:{
      scenario:'仿真情境',start:'开始演示',pause:'暂停',resume:'继续',restart:'重新演示',
      exit:'结束演示',close:'关闭云参观',back:'返回情境选择',next:'下一步',
      progress:'演示进度',stage:'当前阶段',task:'协同任务',agents:'参与角色',
      timeline:'任务过程',results:'本次结果',comparison:'策略对比',
      baseline:'基准策略',coordinated:'协同策略',difference:'差值',
      boundary:'情境说明',goal:'这次看什么',replay:'再次观看',
      pending:'等待反馈',active:'正在处理',complete:'已完成',blocked:'受约束',
      observed:'观测',suggestion:'建议',checked:'已校核',acknowledged:'已回执',
      running:'自动演示进行中',paused:'已暂停',finished:'演示已完成',
      renewableShare:'可再生电力消费占比',gridEnergy:'购电量',curtailment:'弃电量',
      peakGrid:'最大购电功率',storageSoc:'储能SOC',computeCompleted:'等效任务完成量',
      workBacklog:'待完成工作量',unservedEnergy:'未供电量',
      noResult:'完成演示后显示本次计算结果。'
    },
    commonBoundary:'多园区协同与调度用于系统方案能力演示；点击开始后自动完成校核和复盘。结果按当前模型与情境假设计算，不代表现场运行记录。',
    strategyNote:'两种策略使用相同的初始状态、外部条件、计算时段和设备容量；末态储能与待完成任务一并展示。'
  };
  content.scenarios.push({id:'sst',number:'04',title:'SST 多园区能源路由',summary:'先看装备如何改变，再看节点怎样执行功率分配。',goal:'同址替代 · 模块结构 · 柔性电网',tag:'下一代方案／前瞻研究',action:'进入 SST 情境',durationSeconds:108,boundary:'代表性支路独立计算；设备参数为演示假设，主变、交流储能 PCS 与电解锌保持现有方案。',steps:[
    {title:'SST 在柔性电网中的位置',text:'电力从外部电网进入共享能源枢纽，经中压配电到达用能节点。绿色标识定位本轮改造的充电站电源；数据楼的 SST 安装在楼内。能源管理系统安排功率，节点执行指令，储能和柔性负荷提供调节空间。'},
    {title:'先认识现有供电装备',text:'数据楼内的 HVDC 联柜已经集成降压隔离与整流；充电站南北两排各有一套直流电源。这里选择其中的变换单元进行替换，直流输出保护、后备电源与终端配电继续保留。下一步看同一位置如何改变。'},
    {title:'同一位置，切换两套装备方案',text:'灰色轮廓标出原来的隔离与整流变换单元，亮绿色 SST 在原电气区域出现。保留的输出保护仍在原位。北排与南排分别替换，各自连接原有充电支路；不会让两套前端同时供电。接着进入数据楼观察内部。'},
    {title:'走进数据楼的 SST 代表支路',text:'在原 HVDC 联柜的位置打开 SST，观察中压接入、功率模块、中频隔离变压器、直流母排、控制和冷却。后端直流输出、保护与配电保留。这里只代表一套模块化支路，不把整座数据中心的容量集中在一个柜子里。'},
    {title:'从调度指令到节点功率',text:'先看光伏富余窗口，再看充电服务需求增加：上层调度安排充电时段并协调交流储能，SST 节点控制各支路输入与输出。储能仍经既有 PCS 接入交流网络；双向功率来自储能与电网，不来自车辆。'},
    {title:'把结果、库存与交付一起看',text:'A 与 B 只改变装备假设，B 与 C 再改变协同规则。少购电可能伴随更多储能消耗，削峰也可能增加弃电；必须同时比较损耗、末态库存与服务完成情况。下表使用同一天气与需求，所有效率参数都是可编辑模型中的演示假设。'}
  ]});
  return content;
});
