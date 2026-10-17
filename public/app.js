const $ = id => document.getElementById(id);
let active = false;
const providers = [...document.querySelectorAll('input[name="provider"]')];
const provider = () => providers.find(input => input.checked).value;
for (const input of providers) input.addEventListener('change', () => {
  clearAnswer();
  $('model-label').textContent = provider() === 'api' ? 'Gemma 4 26B A4B · Google API' : 'Gemma 4 E2B · Running locally';
});
function clearAnswer() { $('answer').textContent = ''; $('answer-section').hidden = true; $('error').hidden = true; }
$('notes').addEventListener('input', clearAnswer);
function showError(message) { $('error').textContent = message; $('error').hidden = false; }
function showAnswer(text) { $('answer').textContent = text; $('answer-section').hidden = !text.trim(); }
$('notes-form').onsubmit = async event => {
  event.preventDefault();
  if (active) return;
  const notes = $('notes').value.trim(), question = $('question').value.trim();
  if (!notes || !question) return;
  clearAnswer();
  if (!ready()) return;
  active = true;
  providers.forEach(input => input.disabled = true);
  for (const id of ['notes','question','ask']) $(id).disabled = true;
  $('ask').textContent = 'Asking…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const onLeave = () => controller.abort();
  window.addEventListener('pagehide', onLeave, {once:true});
  try { await generate(notes, question, controller.signal, showAnswer); }
  catch (error) { showAnswer(''); showError(error.name === 'AbortError' ? 'The answer took too long. Please try again.' : error.message); }
  finally {
    clearTimeout(timeout);window.removeEventListener('pagehide',onLeave);active=false;
    for (const id of ['notes','question','ask']) $(id).disabled=false;
    $('ask').textContent='Ask Gemma';
    providers.forEach(input => input.disabled = false);
  }
};
function ready() { return true; }
async function generate(notes, question, signal, update) {
  const response = await fetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:provider(),notes,messages:[{role:'user',content:question}]}),signal});
  if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Gemma could not answer.'); }
  let text='',done=false;
  await readLines(response, line => {
    if (!line.trim()) return;
    const event=JSON.parse(line);
    if (event.error) throw new Error(event.error);
    if (event.text) { text+=event.text;update(text); }
    if (event.done) {done=true;if(event.truncated) throw new Error('The answer reached its limit. Try a more specific question.');}
  });
  if (!done || !text.trim()) throw new Error('Gemma did not finish an answer. Please try again.');
}
async function readLines(response, consume) {
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  try {
    while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))!==-1){consume(buffer.slice(0,end).trimEnd());buffer=buffer.slice(end+1);}}
    buffer+=decoder.decode();if(buffer.trim())consume(buffer.trimEnd());
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
}
