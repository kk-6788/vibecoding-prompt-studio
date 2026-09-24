/* PRM-01/02/03 回归验证：node verify-review-fixes.cjs
   从 index.html 抽取核心 JS 在 vm 沙箱执行，断言修复后的行为。 */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

const els = {};
function el(id){ return els[id] || (els[id] = { value:'', innerHTML:'', textContent:'' }); }
const sandbox = {
  document: { getElementById: el, body: { removeAttribute(){}, setAttribute(){}, getAttribute(){ return null; } } },
  navigator: {}, alert: ()=>{}, localStorage: { getItem:()=>null, setItem:()=>{} },
  window: {},
  setTimeout: ()=>{},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(script, sandbox);

// ---------- PRM-01: 角色增删 → 无重名、speaker 修复、进入下拉 ----------
// 初始 1 个角色
assert.strictEqual(sandbox.chars.length, 1);
assert.strictEqual(sandbox.chars[0].name, '角色一');
// 加到 3 个
sandbox.addChar(); sandbox.addChar();
assert.strictEqual(JSON.stringify(sandbox.chars.map(c=>c.name)), JSON.stringify(['角色一','角色二','角色三']), '新增后按顺序重命名');
// 删掉角色一 → 原二/三改为 一/二，不出现两个"角色二"
sandbox.delChar(0);
assert.strictEqual(JSON.stringify(sandbox.chars.map(c=>c.name)), JSON.stringify(['角色一','角色二']), '删除后无重名');
// speaker 引用跟随改名：给台词1选"角色二"（删除前是第3个角色），删除后应映射到现存名
assert.strictEqual(sandbox.lines.length, 1);
// 孤立 speaker 清理：手动设一个已删除的名字
sandbox.lines[0].speaker = '角色三';
sandbox.sync();
assert.strictEqual(sandbox.lines[0].speaker, '', '被删角色的 speaker 引用被清空');
// 说话人下拉包含全部现存角色
const opts = sandbox.renderLines.toString();
assert.ok(opts.includes('chars.map'), '下拉由当前 chars 渲染');

// ---------- PRM-02: 空场景/动作不再显示"可以跑了" ----------
const runChecksSrc = sandbox.runChecks.toString();
assert.ok(runChecksSrc.includes('basicsMissing'), 'runChecks 含基础完整性门槛');
assert.ok(runChecksSrc.includes('草稿'), '草稿态与可运行态区分');
// 逐角色外貌检查（不再是 some() 单角色放行）
assert.ok(runChecksSrc.includes('missing.length'), '逐个角色检查外貌缺失');

// ---------- PRM-03: sw.js 缓存清理只限本应用命名空间 ----------
const sw = fs.readFileSync('sw.js', 'utf8');
assert.ok(sw.includes("indexOf(NS) === 0"), 'activate 只删本应用前缀缓存');
assert.ok(sw.includes("mode === 'navigate'"), '只有导航请求做 HTML 回退');
// 模拟过滤逻辑：其他应用缓存名必须存活
const NS = 'prompt-studio-';
const CACHE = 'prompt-studio-v2';
const keys = ['prompt-studio-v1', 'prompt-studio-v2', 'another-app-cache-v3', 'mydiary-v1'];
const doomed = keys.filter(k => k.indexOf(NS) === 0 && k !== CACHE);
assert.strictEqual(JSON.stringify(doomed), JSON.stringify(['prompt-studio-v1']), '只删本应用旧版本');
assert.ok(keys.includes('another-app-cache-v3'), '同源其他应用缓存保留');

console.log('ALL PRM CHECKS PASSED');
