const { createStories, generatePreviewHeadHtml } = require('../create')

module.exports = {
    command: 'create',
    describe: 'Create stories from AEM content',
    builder: {
        source: {
            alias: 's',
            describe: 'Path to downloaded AEM assets',
            type: 'string',
            default: 'aem-assets'
        }
    },
    handler: (argv) => {
        createStories(argv.source)
        generatePreviewHeadHtml(argv.source)
    }
}