const fs = require('fs');
const hljs = require('highlight.js');
const path = require('path');
const encoding = { encoding: 'utf-8' }

const componentDir = 'component'
const composeDir = 'compose'
const pageDir = 'page'
const outputDir = 'output'
const codeDir = 'code' // highlight.js
const eventDir = 'event'

// unlink all html files in component/code files
let outputCodeHTMLs = fs.readdirSync(path.join(componentDir, codeDir)).filter(p => p.lastIndexOf('.h5') == -1)
outputCodeHTMLs.forEach(file => fs.unlinkSync(path.join(componentDir, codeDir, file)))

fs.readdirSync(path.join(componentDir, codeDir)).forEach(f => {
    let segs = f.split('.')
    segs.pop()
    let language = segs.pop()
    let filename = segs.join('.')
    let content = fs.readFileSync(path.join(componentDir, codeDir, f), encoding)
    let code = ''

    if (language == 'cut') {
        language = 'html'
        code = hljs.highlight(content, { language }).value
        code = `<pre class="text-[12px] p-2">${code}</pre>`
    } else {
        code = hljs.highlight(content, { language }).value
        code = `<pre class="text-[12px] p-2">${code}</pre>`
    }

    fs.writeFileSync(path.join(componentDir, codeDir, filename + '.html'), code, encoding)
})

// unlink all html files in output files
let outputHTMLs = fs.readdirSync(outputDir).filter(p => p.lastIndexOf('.html') > -1)
outputHTMLs.forEach(file => fs.unlink(path.join(outputDir, file), () => { }))

// component
let componentNS = fs.readdirSync(componentDir)
let components = {}
componentNS.forEach(ns => {
    components[ns] = {}
    let files = fs.readdirSync(path.join(componentDir, ns)).filter(p => p.split('.').pop() == 'html')
    files.forEach(file => {
        components[ns][file.split('.html')[0]] = fs.readFileSync(path.join(componentDir, ns, file), encoding)
    })
})
// console.log(components)

let composeNS = fs.readdirSync(composeDir)
let composes = {}
composeNS.forEach(ns => {
    composes[ns] = {}
    let files = fs.readdirSync(path.join(composeDir, ns)).filter(p => p.lastIndexOf('.cut') > -1)
    files.forEach(file => {
        composes[ns][file.split('.cut')[0]] = fs.readFileSync(path.join(composeDir, ns, file), encoding)
    })
})
// console.log(composes)

// page .cut process
fs.readdirSync(pageDir).filter(p => p.lastIndexOf('.cut') > -1).forEach(file => {
    let page = fs.readFileSync(path.join(pageDir, file), encoding)
    let lines = page.trim().split('\n').filter(i => i.indexOf('//') == -1)

    // compose element render
    function composeRender() {
        lines = lines.map(p => {
            let item = {}
            item.deeplevel = p.replaceAll('    ', '^').split('').filter(i => i == '^').length;
            let result = p.trim()

            let comNS = result.split('<')[0]
            item.namespace = comNS
            let comName = result.split('>')[0].split('<')[1]
            item.comName = comName

            // is component
            if (result[0] == '$') {
                let [_, comAttributes] = result.split('@')

                let ss = result.indexOf('(')
                let se = result.indexOf(')')
                if (ss > -1 && se > -1) item.slot = result.slice(ss + 1, se)

                // after @ part
                let attrs = comAttributes?.split('|')
                attrs?.forEach(attr => {
                    let segs = attr.split('=')
                    let attrName = segs[0]
                    let value = ''
                    let ss = segs[1].indexOf('{')
                    let se = segs[1].indexOf('}')
                    if (ss > -1 && se > -1) value = segs[1].slice(ss + 1, se)
                    if (ss == -1 && se == -1) value = segs[1]
                    // if (attrName == 'class') item.class = value
                    // if (attrName == 'style') item.style = value
                    if (attrName == 'repeat') item.repeat = parseInt(value)
                })

                // slot part
                if (item?.slot?.indexOf(':') > -1) {
                    item.props = {}
                    item.slot.split(',').map(i => i.trim().split(':')).forEach(i => item.props[i[0]] = i[1])
                    // slot props replacement
                    Object.keys(tree[i].props).forEach(k => {
                        result = result.replace(`{{${k}}}`, tree[i].props[k])
                    })
                }

                // namespace & component name
                result = result.replaceAll('{{}}', item.slot)

                // replacement
                let clearComments = composes[item.namespace.slice(1)][item.comName].split('\n').filter(i => i.indexOf('//') == -1).join('\n')

                result = clearComments
                    .replaceAll('{{}}', item.slot)
                    .split('\n')
                    .map((i, idx) => {
                        if (idx == 0) {
                            let cls = i.match(/@class={.+}/)
                            let comClass = `${item.namespace.slice(1)}-${item.comName}`
                            if (cls) i = i.replace(cls[0], cls[0].replace('@class={', '@class={' + comClass + " "))
                        }
                        return i
                    })
                    .join(`^${Array(item.deeplevel).fill('    ').join('')}`)
            }

            // repeat
            if (item.repeat) {
                result = Array(item.repeat).fill(Array(item.deeplevel).fill('    ').join('') + result).join('^')
            } else {
                // line head spacing
                result = Array(item.deeplevel).fill('    ').join('') + result
            }

            return result
        })


        page = lines.join('\n')
        page = page.replaceAll('^', '\n')
        lines = page.split('\n').filter(i => i.trim()) // remove empty string
        page = lines.join('\n')
        // console.log(lines)
        // console.log(page)
    }

    // compose element deep replacement
    while (lines.map(i => i.trim()[0]).filter(i => i == '$').length)
        composeRender()

    let parsed = []
    lines.forEach(p => {

        // fall feature sample
        // atom<atom-file-name>(slot1:AAA,slot2:BBB)@class={bg-black text-white}|style={height:'100px'; width:'100px'}|repeat=3

        // save parsed data
        let item = {}
        item.deeplevel = p.replaceAll('    ', '^').split('').filter(i => i == '^').length;
        p = p.trim()

        // before @ part
        let [comInfo, comAttributes] = p.split('@')
        let comNS = comInfo.split('<')[0]
        item.namespace = comNS
        let comName = comInfo.split('>')[0].split('<')[1]
        item.comName = comName
        let ss = comInfo.indexOf('(')
        let se = comInfo.lastIndexOf(')')
        if (ss > -1 && se > -1) item.slot = p.slice(ss + 1, se)

        // slot part
        if (item?.slot?.indexOf(':') > -1) {
            item.props = {}
            item.slot.split(',').map(i => i.trim().split(':')).forEach(i => item.props[i[0]] = i[1])
        }

        // after @ part
        let attrs = comAttributes?.split('|')
        attrs?.forEach(attr => {
            let segs = attr.split('=')
            let attrName = segs[0]
            let value = ''
            let ss = segs[1].indexOf('{')
            let se = segs[1].indexOf('}')
            if (ss > -1 && se > -1) value = segs[1].slice(ss + 1, se)
            if (ss == -1 && se == -1) value = segs[1]
            if (attrName == 'class') item.class = value
            if (attrName == 'style') item.style = value
            if (attrName == 'repeat') item.repeat = parseInt(value)
            if (attrName == 'event') item.event = value
        })

        parsed.push(item)
    })

    // console.log('step1', parsed)

    // modify parsed data format. mutiple top tree groups are saved in roots
    let roots = []
    let group = []
    parsed.forEach(item => {
        // level 0 represents no space in front of code
        if (item.deeplevel == 0) {
            group.length && roots.push(group)
            group = []
        }
        group.push(item)
    })
    roots.push(group)

    // console.log('step2', roots)

    // modify parsed data format. convert flat structure to tree structure
    let children = null
    roots.forEach(group => {
        // calculate max level
        let maxLevel = Math.max(...group.map(item => item.deeplevel))
        for (let i = maxLevel; i >= 0; i--)
            // child nodes check
            group.forEach(item => {
                if (item.deeplevel == i) {
                    children = []
                    item.children = children
                } else if (item.deeplevel == i + 1) {
                    children.push(item)
                }
            })
    })

    // console.log('step3', parsed)

    // modify parsed data format. remove root items which deeplevel != 0
    parsed = parsed.filter(i => i.deeplevel == 0)

    // console.log('step4', parsed)

    // render parsed data
    function renderElements(tree) {
        let output = ''
        for (let i = 0; i < tree.length; i++) {

            let result = components[tree[i].namespace][tree[i].comName]

            // add class
            let cls = result.match(/class=".+"/)
            let comClass = `${tree[i].namespace}-${tree[i].comName}`
            let addClass = (tree[i].class ? (' ' + tree[i].class) : '')
            if (cls) result = result.replace(cls[0], cls[0].replace('class="', 'class="' + comClass + addClass + " "))
            else result = result.replace('>', ` class="${comClass}${addClass}">`)

            // add style
            let addStyle = (tree[i].style ? (tree[i].style) : '')
            let stl = result.match(/style=".+"/)
            if (stl) result = result.replace(stl[0], stl[0].replace('style="', 'style="' + addStyle + " "))
            else if (addStyle) result = result.replace('>', ` style="${addStyle}">`)

            // add event
            if (tree[i].event) {
                let [eventName, cmd] = tree[i].event.split(':')
                cmd = cmd.replace('(', '(\'').replace(')', '\')')
                result = result.replace('>', ` ${eventName}="${cmd.replace('(', '(this,')}">`)
            }

            if (tree[i].props) {
                // slot props replacement
                Object.keys(tree[i].props).forEach(k => {
                    result = result.replace(`{{${k}}}`, tree[i].props[k])
                })
                result = result.replace('{{}}', renderElements(tree[i].children))
            } else {
                // slot replacement: text or atom or component
                result = result.replace('{{}}', tree[i].slot ? tree[i].slot : renderElements(tree[i].children))
            }

            // repeat elements
            if (tree[i].repeat) {
                result = Array(tree[i].repeat).fill(result).join('')
            }

            output += result
        }
        return output
    }

    // get rendered code
    let output = renderElements(parsed)

    // append script
    let scriptTpl = fs.readFileSync(path.join(eventDir, 'cutkit-event.js'), encoding)
    scriptTpl = `<script>${scriptTpl}</script>`

    // generate real code in output folder
    let outputTpl = fs.readFileSync('output.html', encoding)
    outputTpl = outputTpl.replace(`{{tpl}}`, output) + scriptTpl
    fs.writeFileSync(path.join(outputDir, file.split('.cut')[0] + '.html'), outputTpl)

    // console.log('step5', output)
    // console.log(JSON.stringify(parsed, null, '\t'))
})

