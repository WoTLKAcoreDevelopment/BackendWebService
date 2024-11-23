export default{
    name:'wowShopItems',
    type:'document',
    title: 'World of warcraft Shop Items',
    fields: [
        {
            name:'title',
            type:'string',
            title:'Title of shop items',

        },
        {
            name:'description',
            type: 'string',
            title: 'Description of Item',
        },
        {
            name:'price',
            type: 'number',
            title: 'Price of Item',
        },
        {
            name: 'category',
            title: 'Category',
            type: 'string',
            options: {
                list: [
                    {title: 'Transmog', value: 'Transmog Item'},
                    {title: 'Gift Bundle', value: 'Gift Shop Bundle'},
                    {title: 'Mounts', value:"Mounts"},
                ],
                // Optional: make it a radio button list instead of dropdown
                layout: 'dropdown' // or 'radio'
            }
        },
        {
            name:'Image',
            type:'image',
            title:'Item Image',
        }
    ]
}