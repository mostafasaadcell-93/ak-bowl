/* AK Bowl flavors. Macros are copied from each cup's "CALORIES" sleeve as shown on @ak__bowl.
   p = protein (g), c = chocolate (g), k = kcal, f = fat (g). null = not shown on the label yet.
   lid = lid wave colour, ink = lid text colour, fill = cream colour inside the cup, top = topping colour. */
window.AK = {
  price: 3,              // one cup, US$
  box: { size: 10, price: 25 },   // 10 cups (any mix) for $25, free delivery
  instagram: 'https://www.instagram.com/ak__bowl/',
  flavors: [
    { id: 'lotus',      name: 'Lotus',          p: 40, c: 19, k: 377, f: 15.7, lid: '#D9302C', ink: '#C8262A', fill: '#B0723A', top: '#8A5A33', tag: 'Biscoff crunch',        photo: 'lotus' },
    { id: 'pistachio',  name: 'Pistachio',      p: 40, c: 25, k: 210, f: 16,   lid: '#8F8A36', ink: '#6E6A22', fill: '#9AA048', top: '#5C3A22', tag: 'Nutty & green',         photo: 'pistachio' },
    { id: 'snickers',   name: 'Snickers',       p: 35, c: 25, k: 381, f: 15.7, lid: '#5C3020', ink: '#3C3A92', fill: '#6A3D24', top: '#3A2016', tag: 'Peanut caramel',        photo: 'snickers' },
    { id: 'twix',       name: 'Twix',           p: 35, c: 25, k: 309, f: 7.7,  lid: '#D79A3A', ink: '#C0302A', fill: '#A0612C', top: '#4A2A1A', tag: 'Caramel cookie',        photo: 'twix' },
    { id: 'cheesecake', name: 'Cheesecake',     p: 30, c: 18, k: 333, f: 15.7, lid: '#E3B65C', ink: '#B8312C', fill: '#EFE2C4', top: '#C2382F', tag: 'Strawberry & cream',    photo: 'cheesecake' },
    { id: 'peanut',     name: 'Peanut Butter',  p: 25, c: 20, k: 321, f: 15.7, lid: '#B8682C', ink: '#5A3020', fill: '#8E5428', top: '#4A2A1A', tag: 'Creamy & salty-sweet',  photo: 'peanut', lidP: 40 },
    { id: 'kitkat',     name: 'Kit Kat',        p: 25, c: 25, k: 309, f: 7.7,  lid: '#D2232C', ink: '#C3202A', fill: '#74452A', top: '#3E2216', tag: 'Wafer crunch',          photo: 'kitkat' },
    { id: 'galaxy',     name: 'Galaxy',         p: 25, c: 20, k: 321, f: 15.7, lid: '#6A3A22', ink: '#3E2418', fill: '#6A3B22', top: '#3A2016', tag: 'Smooth milk chocolate', photo: 'galaxy' },
    { id: 'oreo',       name: 'Oreo',           p: 25, c: null, k: null, f: null, lid: '#5A88C8', ink: '#2E4F8C', fill: '#7B5D4B', top: '#22201E', tag: 'Cookies & cream',  photo: 'oreo', small: 1 },
    { id: 'dark',       name: 'Dark Chocolate', p: 25, c: 20, k: 241, f: 6.8,  lid: '#3A1F16', ink: '#2E1A12', fill: '#3A2016', top: '#24130D', tag: 'Lowest calories',       photo: 'dark' },
  ],
};
