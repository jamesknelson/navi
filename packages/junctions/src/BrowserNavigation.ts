import { createBrowserHistory, History } from 'history';
import { Junction } from './Junction'
import { Navigation, NavigationState } from './Navigation'
import { RouteType } from './Route'
import { Resolver } from './Resolver'
import { Router } from './Router'
import { RoutingState } from './RoutingState'
import { Observer, SimpleSubscription, createOrPassthroughObserver } from './Observable'
import { HistoryRoutingObservable, createHistoryRoutingObservable } from './HistoryRoutingObservable';
import { areURLDescriptorsEqual } from './URLTools';


export interface BrowserNavigationOptions<Context> {
    /**
     * You can manually supply a history object. This is useful for
     * integration with react-router.
     * 
     * By default, a browser history object will be created.
     */
    history?: History,

    /**
     * Sets `document.title` to the value of the
     * `pageTitle` property in the current junctions' meta, if it exists.
     * 
     * You can also supply a function that reseives `pageTitle`, and
     * returns a processed string that will be set.
     * 
     * Defaults to `true`.
     */
    setDocumentTitle?: boolean | ((pageTitle?: string) => string),

    /**
     * If `true`, this will not scroll the user when navigating between
     * pages.
     */
    disableScrollHandling?: boolean,

    initialRootContext?: Context,

    rootJunction: Junction,
    rootPath?: string,
}


export function createBrowserNavigation<Context>(options: BrowserNavigationOptions<Context>) {
    return new BrowserNavigation(options)
}


export class BrowserNavigation<Context> implements Navigation<Context> {
    router: Router<Context>

    readonly history: History

    private setDocumentTitle: false | ((pageTitle?: string) => string)
    private disableScrollHandling: boolean

    private rootJunction: Junction
    private rootPath?: string
    private resolver: Resolver
    private receivedState: RoutingState
    private renderedState?: RoutingState
    private historyRoutingObservable: HistoryRoutingObservable<Context>

    constructor(options: BrowserNavigationOptions<Context>) {
        this.history = options.history || createBrowserHistory()
        this.resolver = new Resolver
        this.router = new Router(this.resolver, {
            rootContext: options.initialRootContext,
            rootJunction: options.rootJunction,
            rootPath: options.rootPath,
        })

        if (options.setDocumentTitle !== false) {
            this.setDocumentTitle = typeof options.setDocumentTitle === 'function' ? options.setDocumentTitle : ((x?) => x || 'Untitled Page')
        }
        this.disableScrollHandling = !!options.disableScrollHandling

        this.historyRoutingObservable = createHistoryRoutingObservable({
            history: this.history,
            router: this.router,
        })
        this.historyRoutingObservable.subscribe(this.handleChange)
        this.renderedState = this.historyRoutingObservable.getValue()
    }

    setContext(context: Context) {
        this.router = new Router(this.resolver, {
            rootContext: context,
            rootJunction: this.rootJunction,
            rootPath: this.rootPath,
        })
        this.historyRoutingObservable.setRouter(this.router)
    }

    getSnapshot(): NavigationState {
        return {
            history: this.history,
            router: this.router,
            ...this.historyRoutingObservable.getValue(),
            onRendered: this.handleRendered,
        }
    }

    async getSteadyState(): Promise<NavigationState> {
        return this.historyRoutingObservable.getSteadyState().then(routingState => ({
            history: this.history,
            router: this.router,
            ...routingState,
            onRendered: this.handleRendered,
        }))
    }

    /**
     * If you're using code splitting, you'll need to subscribe to changes to
     * Navigation state, as the state may change as new code chunks are
     * received.
     */
    subscribe(
        onNextOrObserver: Observer<NavigationState> | ((value: NavigationState) => void),
        onError?: (error: any) => void,
        onComplete?: () => void
    ): SimpleSubscription {
        let navigationObserver = createOrPassthroughObserver(onNextOrObserver, onError, onComplete)
        let mapObserver = new MapObserver(navigationObserver, this.history, this.router, this.handleRendered)
        return this.historyRoutingObservable.subscribe(mapObserver)
    }

    private handleChange = (state: RoutingState) => {
        this.receivedState = state
    }

    private handleRendered = () => {
        if (this.renderedState !== this.receivedState) {
            let prevState = this.renderedState
            let nextState = this.receivedState

            if (nextState && nextState.lastRoute.type === RouteType.Page && this.setDocumentTitle) {
                document.title = this.setDocumentTitle(nextState.lastRoute.title)
            }

            if (nextState && nextState.isSteady) {
                if (prevState && areURLDescriptorsEqual(nextState.url, prevState.url)) {
                    return
                }

                if (!this.disableScrollHandling &&
                    (!prevState ||
                    !prevState.url ||
                    prevState.url.hash !== nextState.url.hash ||
                    prevState.url.pathname !== nextState.url.pathname)
                ) {
                    scrollToHash(nextState.url.hash)
                }
            }

            this.renderedState = this.receivedState
        }
    }
}


function scrollToHash(hash) {
    if (hash) {
        let id = document.getElementById(hash.slice(1))
        if (id) {
            id.scrollIntoView({
                behavior: 'instant',
                block: 'start'
            })

            // Focus the element, as default behavior is cancelled.
            // https://css-tricks.com/snippets/jquery/smooth-scrolling/
            id.focus()
        }
    }
    else {
        window.scroll({
            top: 0, 
            left: 0, 
            behavior: 'instant' 
        })
    }
}


class MapObserver implements Observer<RoutingState> {
    history: History
    router: Router<any>
    observer: Observer<NavigationState>
    onRendered: () => void

    constructor(observer: Observer<RoutingState>, history: History, router: Router<any>, onRendered: () => void) {
        this.observer = observer
        this.history = history
        this.router = router
        this.onRendered = onRendered
    }

    next(routingState: RoutingState): void {
        this.observer.next({
            history: this.history,
            router: this.router,
            ...routingState,
            onRendered: this.onRendered,
        })
    }
    error(errorValue: any): void {
        if (this.observer.error) {
            this.observer.error(errorValue)
        }
    }
}