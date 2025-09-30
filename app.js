const fs = require('fs');
const path = require('path');

const coms = fs.readdirSync('component')
const componentObjs = {}
coms.forEach(com => {
    let comName = com.split('.html')[0]
    let comContent = fs.readFileSync('component' + path.sep + com, { encoding: 'utf-8' })
    componentObjs[comName] = comContent.replace(`class="`, `class="${comName} `)
});

const cuts = fs.readdirSync('compose')
const composeObjs = {}
cuts.forEach(cut => {
    let cutName = cut.split('.cut')[0]
    let cutContent = fs.readFileSync('compose' + path.sep + cut, { encoding: 'utf-8' })
    composeObjs[cutName] = cutContent
})

fs.readdirSync('design').forEach(design_cut => {

    let page = fs.readFileSync(`design/${design_cut}`, { encoding: 'utf-8' })

    Object.keys(composeObjs).forEach(key => {
        let lenArray = []
        page.trim().split('\n').forEach((p, idx) => {
            if (p.indexOf(key) > -1) {
                let len = p.replaceAll('    ', '@').split('').filter(i => i == '@').length;
                lenArray.push(len)
            }
        })
        lenArray.forEach(len => {
            let compose = composeObjs[key].trim().split('\n').map((c, idx) => idx ? (Array(len).fill('    ').join('') + c) : c).join('\n')
            page = page.replace(key, compose)
        })
    })

    let parsed = []
    page.trim().split('\n').forEach((p, idx) => {
        let len = p.replaceAll('    ', '@').split('').filter(i => i == '@').length;
        let item = { level: len, line: idx }
        p = p.trim()
        let segs = p.split(':')
        let ss = p.indexOf('<')
        let se = p.indexOf('>')
        if (ss > -1 && se > -1) item.text = p.slice(ss + 1, se)
        ss = p.indexOf('{')
        se = p.indexOf('}')
        if (ss > -1 && se > -1) item.css = p.slice(ss + 1, se)
        item.node = segs[0]
        parsed.push(item)
    })

    let currentLine = -1
    let roots = []
    let group = []
    parsed.forEach(p => {
        if (p.level == 0 && currentLine != p.line) {
            currentLine = p.line
            group.length && roots.push(group)
            group = []
        }
        group.push(p)
    })
    roots.push(group)

    let parent = null
    roots.forEach(group => {
        let maxLevel = Math.max(...group.map(i => i.level))
        for (let i = maxLevel; i >= 0; i--)
            group.forEach(item => {
                if (item.level == i) {
                    parent = []
                    item.children = parent
                } else if (item.level == i + 1) {
                    parent.push(item)
                }
            })
    })

    parsed = parsed.filter(i => i.level == 0)

    function renderElements(tree) {

        let output = ''
        for (let i = 0; i < tree.length; i++) {
            let result = componentObjs[tree[i].node] + ''
            if (tree[i].css) {
                let cls = result.match(/class=".+"/)
                result = result.replace(cls, cls[0].slice(0, cls[0].length - 1) + ' ' + tree[i].css + '"')
            }
            output += result.replace('{{}}', tree[i].text ? tree[i].text : renderElements(tree[i].children))
        }
        return output
    }
    let output = renderElements(parsed)

    let indexTpl = fs.readFileSync('output.html', { encoding: 'utf-8' })
    indexTpl = indexTpl.replace(`{{tpl}}`, output)
    fs.writeFileSync('output' + path.sep + design_cut.split('.')[0] + '.html', indexTpl)

})