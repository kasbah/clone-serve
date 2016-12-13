//@flow
const cp            = require('child_process')
const crypto        = require('crypto')
const path          = require('path')
const fs            = require('fs')
const glob          = require('glob')
const rimraf        = require('rimraf')

const config           = require('./config')
const {store, actions} = require('./actions')

import type {RepoStatus} from './reducers'

let prev_state = store.getState()
store.subscribe(handleChanges)

function handleChanges() {
    const state = store.getState()
    if (! state.equals(prev_state)) {
        const sessions = state.get('sessions')
        const previous_sessions = prev_state.get('sessions')
        sessions.forEach((session, id) =>  {
            if (! session.equals(previous_sessions.get(id))) {
                handleSessionChanges(session, id)
            }
        })
        removeUnusedFiles(sessions)
    }
    prev_state = state
}

function removeUnusedFiles(sessions) {
    const keys = sessions.keySeq()
    glob(path.join(config.session_data, '*'), (err, files) => {
         if (err)  {
             return console.error('glob', err)
         }
         const folder_ids = files.map(path.relative.bind(null, config.session_data))
         folder_ids.forEach(id => {
             if (! keys.contains(id)) {
                 const p = path.join(config.session_data, id)
                 rimraf(p, {disableGlob: true}, (err) => {
                     if (err) {
                         console.error('rimraf', err)
                     }
                 })
             }
         })
    })
}

function handleSessionChanges(session, id) {
    session.get('repos').forEach((repo, url) => {
        const status = repo.get('status')
        if (status === 'start') {
            return startClone(id, url)
        }
        else if (status === 'clone_done') {
            const slug = repo.get('slug')
            return getFiles(id, url, slug)
        }
    })
}

function getFiles(id: string, url: string, slug) {
    if (slug == null) {
        console.error('no slug when trying to list files')
        return actions.setRepoStatus(id, {url, status: 'failed'})
    }
    const folder = toFolder(id, slug)
    const options = {dot: true, nodir: true, ignore: path.join(folder, '.git/**/*')}
    return glob(path.join(folder, '**/*'), options,(err, filepaths) => {
        if (err) {
            console.error('glob', err)
            return actions.setRepoStatus(id, {url, status: 'failed'})
        }
        const files = filepaths.map(path.relative.bind(null, path.join(config.session_data, id)))
        return actions.setRepoStatus(id, {url, status: 'done', files})
    })
}

function startClone(id: string, url: string) {
    const slug = hash(url)
    const folder = toFolder(id, slug)
    return fs.exists(folder, exists => {
        const process = exists ? fetch(id, url, slug) : clone(id, url, slug)
        actions.setRepoStatus(id, {url, status:'cloning', slug})
        process.on('exit', reportStatus.bind(null, id, url))
    })
}

function fetch(id, url, slug) {
    const folder = toFolder(id, slug)
    return cp.exec(`cd ${folder} && git fetch && git reset --hard origin/HEAD`)
}

function clone(id, url, slug) {
    const folder = toFolder(id, slug)
    return cp.exec(`git clone --depth=1 ${url} ${folder}`)
}

function reportStatus(id, url, processStatus) {
    if (processStatus !== 0) {
        console.warn('git clone/fetch failed')
        actions.setRepoStatus(id, {url, status:'failed'})
    }
    else {
        actions.setRepoStatus(id, {url, status:'clone_done'})
    }
}

function toFolder(id, slug)  {
    return path.join(config.session_data, id, slug)
}

function hash(str) {
    return crypto.createHash('sha1').update(str).digest('hex').slice(0, 7)
}
