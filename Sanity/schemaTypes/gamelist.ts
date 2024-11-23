export default {
    name: 'gameList',
    type: 'document',
    title: 'GameList',
    fields: [
        {
            name: 'title',
            type: 'string',
            title: 'Title of article',
        },
        {
            type: 'slug',
            title: 'Slug',
            name: 'slug',
            options: {
                source:'title',
            }
        },
        {
            name:'titleImage',
            type: 'image',
            title: 'Title Image',
        },
        {
            name:'smallDescription',
            type:'text',
            title: 'Description',
        },
        {
            name:'content',
            type:'array',
            title: 'Content',
            of:[
                {
                    type: 'block',
                }
            ]
        }
    ]
}