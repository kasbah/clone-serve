//     
const Immutable = require('immutable')
const redux = require('redux')

//type State = {
//    sessions : Immutable.Map<string, Session>
//}
                                     

const initial_state         = Immutable.Map({
    sessions: Immutable.Map()
})

               
                     
                       
                 
 


                
                                            
 

                                                  

const sessionReducers = {
    startClone(session          , repo_folder         ) {
        const repo = session.repos.get(repo_folder)
        if (repo == null || repo === 'done') {
            const repos = session.repos.set(repo_folder, 'start')
            return Object.assign(session, {repos})
        }
        return session
    }
}

const stateReducers = {
    removeSession(state        , session_id         ) {
        const sessions = state.get('sessions').delete(session_id)
        return state.set('sessions', sessions)
    }
}

                                                                             


function mainReducer(state        , action        )        {
    if (state == null) {
        state = initial_state
    }
    if (action.session_id == null) {
        return state
    }
    let session            = state.get('sessions').get(action.session_id)
    if (session == null) {
        session = {
            repos: Immutable.Map()
        }
    }
    session = Object.keys(sessionReducers).reduce((session, name) => {
        if (name == action.type) {
            return sessionReducers[name](session, action.value)
        }
        return session
    }, session)
    const sessions = state.get('sessions').set(action.session_id, session)
    state = state.set('sessions', sessions)
    state = Object.keys(stateReducers).reduce((state, name) => {
        if (name == action.type) {
            let value
            if (action.value == null) {
                value = action.session_id
            } else {
                value = action.value
            }
            return stateReducers[name](state, value)
        }
        return state
    }, state)
    return state

}


module.exports = {sessionReducers, stateReducers, mainReducer, initial_state}