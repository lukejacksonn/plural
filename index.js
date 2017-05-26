const { h, app, Router } = hyperapp
const defer = fn => setTimeout(fn, 0)

// Check to see if github redirect has occured
const redirect = sessionStorage.redirect;
delete sessionStorage.redirect;
if (redirect && redirect != location.href) {
  history.replaceState(null, null, redirect);
}

const getParameterByName = name => {
  var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

const mutable = function (e) {
  // Elements initial width and height
  const h = this.offsetHeight;
  const w = this.offsetWidth;
  // Elements original position
  const t = this.offsetTop;
  const l = this.offsetLeft;
  // Click position within element
  const y = t + h - e.pageY;
  const x = l + w - e.pageX;
  // Check if element has moved
  const hasMoved = () =>
    !(t === this.offsetTop && l === this.offsetLeft);
  // Track position of the mouse
  const follow = (e) => {
    // Set top/left of element according to mouse position
    this.style.top = `${e.pageY + y - h}px`;
    this.style.left = `${e.pageX + x - w}px`;
  }
  // Tidy up when finished interacting
  const unfollow = (e) => {
    // Remove listeners that were bound to document
    document.removeEventListener('mousemove', follow);
    document.removeEventListener("mouseup", unfollow);
    // Emit events according to interaction
    if (hasMoved(e)) this.dispatchEvent(new Event('moved'));
    else this.dispatchEvent(new Event('clicked'));
    e.preventDefault();
  }
  // Add follow listener if not resizing
  document.addEventListener("mousemove", follow);
  document.addEventListener("mouseup", unfollow);
  e.preventDefault();
}

const Grid = ({ children, gutter, padding, itemFlex }) =>
  h('grid-', { style: {
    display: 'flex',
    flexFlow: 'row wrap',
    paddingTop: padding,
    paddingLeft: padding,
    paddingBottom: padding > gutter ? `calc(${padding} - ${gutter})` : '',
    paddingRight: padding > gutter ? `calc(${padding} - ${gutter})` : '',
    marginBottom: padding < gutter ? `calc(${padding} - ${gutter})` : '',
    marginRight: padding < gutter ? `calc(${padding} - ${gutter})` : '',
  }}, children.map(
    x => h('item-', { style: {
      margin: `0 ${gutter} ${gutter} 0`,
      flex: itemFlex,
    }}, x)
  ))

const toggleFocus = e => {
  const $elem = document.querySelector('video-.focus')
  // Prepare focussed element for window
  $elem.style.top = e.target.style.top;
  $elem.style.left = e.target.style.left;
  $elem.classList.toggle('focus')
  // Prepare windowed item for focus
  e.target.style = '';
  e.target.classList.toggle('focus')
}

const CreateYoutubeThumb = a => (id, index) =>
  h('thumb-', {
    style: (id && id.length > 10)
      ? { backgroundImage: `url(https://img.youtube.com/vi/${ id }/maxresdefault.jpg)` }
      : { borderWidth: '.2rem' }
  }, [
    h('div', {}, h('input', {
      placeholder: 'PASTE YOUTUBE URL',
      style: (id && id.length > 10) ? { display: 'none' } : {},
      oninput: e => index === 0
        ? a.create.setPrimary(e.target.value.replace('https://www.youtube.com/watch?v=',''))
        : a.create.setSecondary(e.target.value.replace('https://www.youtube.com/watch?v=',''))
    })),
  ])

const CreatePair = s => a =>
  h('pair-', {
    onclick: e => (s.create.primary && s.create.secondary)
      ? a.router.go(`/${s.create.primary}/${s.create.secondary}`)
      : null
  }, [
    h('title-', null, s.create.primary && s.create.secondary
      ? `plural.video/${s.create.primary}/${s.create.secondary}`
      : ''
    ),
    CreateYoutubeThumb(a)(s.create.primary, 0),
    CreateYoutubeThumb(a)(s.create.secondary, 1),
  ]
)

const YoutubeThumb = id =>
  h('thumb-', {
    style: { backgroundImage: `url(https://img.youtube.com/vi/${ id }/hqdefault.jpg)` },
  })

const Pair = a => (url, text) =>
  h('pair-', {
    onclick: e => e.preventDefault() || a.router.go(url),
  }, [
    h('title-', null, text),
    YoutubeThumb(url.split('?')[0].split('/')[1]),
    YoutubeThumb(url.split('?')[0].split('/')[2]),
  ]
)

const Video = s => a => (vid,index) =>
  h('video-', {
    class: index === 0 ? 'focus' : '',
    oncreate: e => e.addEventListener('clicked', toggleFocus),
    onmousedown: mutable,
  }, iframe(s)(a)(vid, index))

const iframe = s => a => (vid,index) =>
  h('iframe-', {
    id: 'v--' + vid.id + '--' + index,
    oncreate: e => defer(_ =>
      a.assignPlayer({
        id: vid.id,
        player: new YT.Player(e.id, {
          playerVars: {
            showinfo: 0,
            rel: 0,
            html5: 1,
            playsinline: 1,
            iv_load_policy: 3,
            controls: index === 0 ? 1 : 0,
          },
          events: {
            onReady: e => {
              a.setPlayerReady(index)
              index === 0
              ? e.target.loadVideoById(vid.id, 0.01)
              : e.target.loadVideoById(vid.id, s.timeOffset)
              index === 0 ? null : e.target.mute()
            },
            onStateChange: e => a.setPlayState({
              playState: e.data,
              currentTime: e.target.getCurrentTime(),
            }),
          },
        })
      })
    )
  })

function onYouTubeIframeAPIReady() {
  app({
    state: {
      playState: -1,
      currentTime: 0,
      timeOffset: 0,
      videos: [],
      create: {
        primary: null,
        secondary: null,
      }
    },
    actions: {
      create: {
        setPrimary: (s,a,d) => ({ create: Object.assign({}, s.create, { primary: d }) }),
        setSecondary: (s,a,d) => ({ create: Object.assign({}, s.create, { secondary: d }) }),
      },
      setPlayerReady: (s,a,d) => R.assocPath(['videos',d,'ready'], true, s),
      setTimeOffset: (s,a,d) => ({ timeOffset: parseFloat(d) || 0 }),
      setVideos: (s,a,d) => ({ videos: d }),
      setPlayState: (s,a, { playState, currentTime }) => ({ playState, currentTime }),
      pausePlayers: s => s.videos.forEach(vid => vid.ready ? vid.player.pauseVideo() : null),
      playPlayers: s => s.videos.forEach(vid => vid.ready ? vid.player.playVideo() : null),
      syncPlayers: (s,a,d) => {
        s.videos[1].player.seekTo(s.videos[0].player.getCurrentTime() + s.timeOffset)
      },
      assignPlayer: (s,a,d) => {
        const vid = s.videos.find(x => x.id === d.id)
        return ({ videos: s.videos
          .filter(x => x.id !== d.id)
          .concat(Object.assign({}, vid, {
            player: d.player
          }))
        })
      },
    },
    events: {
      route: (s,a,d) => {
        d.match !== '/:a/:b'
          ? a.setVideos([])
          : a.setTimeOffset(getParameterByName('t')) ||
            a.setVideos([
              { id: d.params.a },
              { id: d.params.b },
            ])
      },
      update: (s,a,d) => {
        if (d.playState === 1) a.playPlayers()
        if (d.playState === 2) a.pausePlayers()
        if(s.videos.length === 2 && s.videos[0].ready && s.videos[1].ready) {
          const timeDiff = Math.abs(s.videos[0].player.getCurrentTime() - s.videos[1].player.getCurrentTime())
          if((Math.abs(Math.abs(s.timeOffset) - timeDiff)) > 0.1) a.syncPlayers()
        }
      },
    },
    view: {
      '/:a/:b': (s,a) => h('watch-', null, s.videos.map(Video(s)(a))),
      '/create': (s,a) => h('create-', null, CreatePair(s)(a)),
      '/': (s,a) => h('home-', null, [
        h('nav', null, [
          h('h1', null, 'plural.video'),
          h('button', {
            onclick: e => a.router.go('/create')
          }, 'CREATE'),
        ]),
        h('header', null, [
          h('p', null, 'picture-in-picture interface for videos with concurrent perspectives'),
        ]),
        Grid({
          gutter: '2rem',
          padding: '3rem',
          itemFlex: '15rem',
          children: [
            // Pair(a)('/0epjkvrAaJw/qFiceUAUarQ', 0.5, 'Red Bull Rampage 2015: Kurt Sorge'),
            // Pair(a)('/o9cPWOdq-J4/AWggPLXeOkU', -4.7, 'Aaron Kitcher - BMTH - Play For Pragues'),
            // Pair(a)('/9BxoCArA6io/raB504ga-oY?t=11.4', 'Issues - The Realest'),
            // Pair(a)('/k40HGu_x0bg/1RmJjrxCaCs?t=0', 'CS50 Lecture 0 - Fall 2016'),
            // Pair(a)('/nmkrr-8Lnds/KWg87y_4Eg8?t=2.3', 'Issues - COMA - Guitar & Drum Cover'),
            // Pair(a)('/VbxZqLJwV3g/7BXNWFcVTcs?t=-0.2', 'Periphery - Alpha - Guitar & Drum Cover'),
            // Pair(a)('/jmLj33UQkik/fRNkQH4DVg8?t=0.6', 'The Chainsmokers - Paris - Drum & Video'),
            Pair(a)('/8ELbX5CMomE/fRh_vgS2dFE?t=0', 'Justin Bieber - Sorry'),
            Pair(a)('/uAVUl0cAKpo/A9u7ScKKl0E?t=0', 'Sabrina Carpenter - Thumbs'),
            Pair(a)('/WA4iX5D9Z64/gcMn_Eu-XTE?t=-3', 'Taylor Swift - Never Getting Back Together'),
            Pair(a)('/JGwWNGJdvx8/_dK2tDK9grQ?t=-5.9', 'Ed Sheeran - Shape of You'),
          ]
        }),
      ]),
    },
    plugins: [Router],
  })
}
