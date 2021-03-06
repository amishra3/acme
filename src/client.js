const core = require('./core')
const utils = require('./utils')
const path = require('path')
const mkdirp = require('mkdirp')
const log = require('debug')('acme:Pull content')
const chalk = require('chalk')

let getData, containerPath, containerType, assetsDir, titleResourceType

const init = (config) => {
    getData = core.getData.bind(null, config.credentials, config.baseURL)
    containerPath = config.containerPath
    containerType = config.containerType
    assetsDir = config.assetsDir
    titleResourceType = config.titleResourceType
}

const getComponentPages = async (contentPath) => {
    return getData(utils.getJsonPath(contentPath))
        .then(core.getJson)
        .then(core.getPagePaths)
}

const getRenderedComponent = async (
    componentContentPath,
    title,
    componentLogMsg,
    componentDir
) => {
    log(
        `Saving template file for ${chalk.yellow.bold(
            title
        )} state of ${componentLogMsg} component`
    )
    const filename = title.replace(/\W+/g, '-') + '.html'
    const writeToFile = utils.writeToFile.bind(
        null,
        `${componentDir}/${filename}`
    )
    return getData(utils.getHtmlPath(componentContentPath))
        .then(async (response) => {
            const html = await core.getHtml(response)
            getContent(html)
            writeToFile(utils.tidy(html))
        })
        .catch((error) => {
            throw new Error(error)
        })
}

const getRenderedComponents = async (json, pageUrl) => {
    // console.log(json)
    const component = pageUrl.split('/').pop()
    const componentLogMsg = chalk.green.bold(component)
    log(`Retrieving states from ${componentLogMsg} component page`)
    const componentDir = `${assetsDir}/components/${component}`
    const componentPaths = core.getComponentPaths(json, containerType)
    const titles = core.getTitles(
        json,
        titleResourceType,
        containerPath,
        componentPaths.length
    )

    mkdirp.sync(componentDir)
    const result = []
    for (const [ind, componentPath] of componentPaths.entries()) {
        const title = titles[ind]
        const componentContentPath = pageUrl + componentPath
        result.push(
            getRenderedComponent(
                componentContentPath,
                title,
                componentLogMsg,
                componentDir
            )
        )
    }
    return result
}

const getAllComponents = async (contentPath) => {
    return getComponentPages(contentPath)
        .then((pagePaths) => {
            const result = []
            for (const pagePath of pagePaths) {
                const fullPagePath = contentPath + pagePath
                const components = getData(utils.getJsonPath(fullPagePath))
                    .then(core.getJson)
                    .then((json) => {
                        return getRenderedComponents(json, fullPagePath)
                    })
                result.push(components)
            }
            return result
        })
        .then(Promise.all.bind(Promise))
}

const getContent = async (html) => {
    const resourcePaths = core.getResourcePaths(html)

    resourcePaths
        .filter((p) => {
            const isExternal = /^http/.test(p)
            if (isExternal) {
                log(`Skipping external resource: ${chalk.red(p)}`)
            }
            return !isExternal
        })
        .forEach((resourcePath) => {
            const filename = path.basename(resourcePath)
            const filepath = path.dirname(resourcePath)

            const targetPath = path.join(assetsDir, filepath)
            // console.log(baseURL + resourcePath)
            mkdirp.sync(targetPath)
            getData(resourcePath).then((response) => {
                core.writeToFile(response, `${targetPath}/${filename}`)
            })
        })
}

/* const getFonts = async (response, resourceDir, targetPath) => {
    if (
        response.headers
            .get('content-type')
            .includes('text/css')
    ) {
        const cssCode = await response.text()
        const fontUrls = core.getFontUrls(cssCode)
        fontUrls.forEach(async (fontPath) => {
            const fontUrl = path.join(
                resourceDir,
                fontPath
            )
            const filename = path.basename(fontPath)
            await getData(fontUrl).then(async (response) => {
                const fontDir = path.join(
                    targetPath,
                    path.dirname(fontPath)
                )
                mkdirp.sync(fontDir)
                await core.writeToFile(
                    response,
                    path.join(fontDir, filename)
                )
            })
        })
    }
} */

const getResources = async (contentPath) => {
    return getData(utils.getHtmlPath(contentPath))
        .then(core.getHtml)
        .then((html) => {
            const resourcePaths = core.getResourcePaths(html)
            const targetPath = path.join(assetsDir, 'resources')
            mkdirp.sync(targetPath)
            const resources = []
            resourcePaths
                .filter((p) => {
                    // TODO - Define whitelist in config
                    return ['clientlib-base', 'http'].some((x) =>
                        p.includes(x)
                    )
                })
                .forEach(async (resourcePath) => {
                    const filename = path.basename(resourcePath)
                    // const resourceDir = path.dirname(resourcePath)
                    const resource = getData(resourcePath).then(
                        async (response) => {
                            // const clone = response.clone()
                            // getFonts(clone, resourceDir, targetPath)
                            return core.writeToFile(
                                response,
                                path.join(targetPath, filename)
                            )
                        }
                    )
                    resources.push(resource)
                })
            return Promise.all(resources)
        })
}

const getPolicy = async (policyPath, policiesDir) => {
    const component = path.basename(policyPath)
    log(`Retrieving policy for ${chalk.green.bold(component)} component`)
    return getData(utils.getJsonPath(policyPath)).then((response) => {
        const filepath = path.format({
            dir: policiesDir,
            name: component,
            ext: '.json'
        })
        return core.writeToFile(response, filepath)
    })
}

const getPolicies = async (policiesUrl) => {
    return getData(utils.getJsonPath(policiesUrl))
        .then(core.getJson)
        .then((json) => {
            // console.log(json)
            const policyPaths = core.getPolicyPaths(json)
            // console.log(paths)
            const policiesDir = assetsDir + '/policies'
            mkdirp.sync(policiesDir)

            const result = []
            for (const policyPath of policyPaths) {
                result.push(getPolicy(policiesUrl + policyPath, policiesDir))
            }
            return result
        })
        .then(Promise.all.bind(Promise))
}

exports.getAllComponents = getAllComponents
exports.getResources = getResources
exports.getPolicies = getPolicies
exports.init = init
