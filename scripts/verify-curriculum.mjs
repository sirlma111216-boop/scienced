import assert from 'node:assert/strict'
import {readFileSync, existsSync} from 'node:fs'
const data=JSON.parse(readFileSync('public/curriculum/science-2022.json','utf8'))
assert.equal(data.pages.length,292)
assert.equal(data.sections.length,18)
for (const [i,p] of data.pages.entries()) {
 assert.equal(p.page,i+1)
 assert.ok(existsSync(`public/curriculum/pages/${p.page}.webp`),`Missing page image ${p.page}`)
}
for (const [i,s] of data.sections.entries()) {
 assert.ok(s.start<=s.end && s.end<=292)
 if(i)assert.equal(data.sections[i-1].end+1,s.start)
 const title=s.title.replace(' (초등학교·중학교)','').split('·')[0]
 assert.ok(data.pages[s.start-1].text.replace(/\s/g,'').includes(title.replace(/\s/g,'')),s.title)
}
const biology=data.sections.find(s=>s.title==='생명과학')
const found=data.pages.filter(p=>p.page>=biology.start&&p.page<=biology.end&&p.text.replace(/\s/g,'').includes('12생과02-04'))
assert.ok(found.some(p=>p.page===141))
for(const path of ['src/components/layout/FooterNav.tsx','src/routes/Home.tsx']) assert.ok(!/to[:=].{0,3}\/(portfolio|concept-map)/.test(readFileSync(path,'utf8')))
console.log('Curriculum: 292 pages, 18 course groups, all page images, achievement-code lookup, removed menus verified.')
