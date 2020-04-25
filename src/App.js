// @flow

import React from 'react';
import './App.css';
import graphql from 'babel-plugin-relay/macro';
import stableCopy from 'relay-runtime/lib/util/stableCopy';
import {QueryRenderer, fetchQuery} from 'react-relay';
import {
  RelayEnvironmentProvider,
  usePreloadedQuery,
  useLazyLoadQuery,
  preloadQuery,
} from 'react-relay/hooks';
import Posts from './Posts';
import Post, {PostBox} from './Post';
import Comments from './Comments';
import {onegraphAuth} from './Environment';
import {Router, Location} from '@reach/router';
import Link from './PreloadLink';
import {NotificationContainer, NotificationContext} from './Notifications';
import OneGraphLogo from './oneGraphLogo';
import {Grommet} from 'grommet/components/Grommet';
import {Grid} from 'grommet/components/Grid';
import {Box} from 'grommet/components/Box';
import {Heading} from 'grommet/components/Heading';
import {Text} from 'grommet/components/Text';
import {Anchor} from 'grommet/components/Anchor';
import {ResponsiveContext} from 'grommet/contexts/ResponsiveContext';
import {generate} from 'grommet/themes/base';
import {deepMerge} from 'grommet/utils/object';
import {StatusCritical} from 'grommet-icons/icons/StatusCritical';
import UserContext from './UserContext';
import {Helmet} from 'react-helmet';
import {ScrollContext} from 'gatsby-react-router-scroll';
import Avatar from './Avatar';
import config from './config';
import {css} from 'styled-components';
import {editIssueUrl} from './issueUrls';
import {Github} from 'grommet-icons/icons/Github';
import PreloadCache from './preloadQueryCache';
import PreloadCacheContext from './PreloadCacheContext';
import {SkipNavLink, SkipNavContent} from '@reach/skip-nav';
import '@reach/skip-nav/styles.css';

import type {LoginStatus} from './UserContext';
import type {
  App_QueryResponse,
  App_Query,
} from './__generated__/App_Query.graphql';
import type {App_PostQueryResponse} from './__generated__/App_PostQuery.graphql';

import type {Environment} from 'relay-runtime';
import type {RelayNetworkError} from 'react-relay';

export const theme = deepMerge(generate(24, 10), {
  global: {
    colors: {
      brand: '#1997c6',
      'accent-1': '#3cc7b7',
      focus: 'rgba(60, 199, 183, 0.75)',
    },
    font: {
      family:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    },
  },
  anchor: {
    fontWeight: 'normal',
    textDecoration: 'underline',
    color: null,
  },
  button: {
    border: {
      radius: 4,
    },
    extend(props) {
      return props.plain
        ? null
        : css`
            &:hover {
              box-shadow: none;
              color: ${props.theme.global.colors.brand};
            }
          `;
    },
  },
});

function Header({large}: {large?: boolean}) {
  return (
    <div
      className={
        'mb-4 text-center flex px-6 ' +
        (large
          ? 'justify-center items-center flex-col bg-gray-900 md:mb-8'
          : 'mt-8 md:mt-10 md:mb-4')
      }
      style={large ? {height: '45vh'} : {}}>
      <Link
        getProps={({isCurrent}) => ({
          style: isCurrent
            ? {
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'auto',
              }
            : {
                color: 'inherit',
                textDecoration: 'none',
              },
        })}
        to="/">
        <img
          src={
            large
              ? require('./assets/logo-white.svg')
              : require('./assets/logo.svg')
          }
          alt="Arizon AB"
          className={large ? 'h-20 mx-auto' : 'h-12'}
        />
      </Link>

      {large ? <LinkSection iconSize="1.5rem" white={true} /> : null}
    </div>
  );
}

const postsRootQuery = graphql`
  # repoName and repoOwner provided by fixedVariables
  query App_Query($repoName: String!, $repoOwner: String!)
    @persistedQueryConfiguration(
      accessToken: {environmentVariable: "OG_GITHUB_TOKEN"}
      fixedVariables: {environmentVariable: "REPOSITORY_FIXED_VARIABLES"}
      cacheSeconds: 300
    ) {
    devTo {
      articles(username: "zth") {
        edges {
          node {
            positiveReactionsCount
            commentsCount
            crosspostedAt
            canonicalUrl
          }
        }
      }
    }
    gitHub {
      repository(name: $repoName, owner: $repoOwner) {
        ...Posts_repository
      }
    }
  }
`;

const ErrorBox = ({error}: {error: any}) => {
  const relayError = error?.source?.errors?.[0]?.message;
  return (
    <Box
      margin={{vertical: 'large'}}
      gap="xsmall"
      justify="center"
      align="center"
      direction="row">
      <StatusCritical color="status-error" />{' '}
      <Text size="medium">
        {relayError || error.message}
        {error.type === 'missing-cors' ? (
          <div>
            {' '}
            Allow the current URL in the CORS Origins form on the{' '}
            <a
              target="_blank"
              rel="noreferrer noopener"
              href={`https://www.onegraph.com/dashboard/app/${config.appId}`}>
              OneGraph Dashboard
            </a>
            .
          </div>
        ) : null}
      </Text>
    </Box>
  );
};

class ErrorBoundary extends React.Component<{children: *}, {error: ?Error}> {
  constructor(props) {
    super(props);
    this.state = {error: null};
  }

  static getDerivedStateFromError(error) {
    return {
      error,
    };
  }

  render() {
    if (this.state.error != null) {
      return <ErrorBox error={this.state.error} />;
    }
    return this.props.children;
  }
}

function PostsRoot({preloadedQuery}: {preloadedQuery: any}) {
  const data: App_QueryResponse = usePreloadedQuery<App_QueryResponse>(
    postsRootQuery,
    preloadedQuery,
  );
  const respository = data?.gitHub ? data?.gitHub.repository : null;
  if (!respository || !data.gitHub) {
    return <ErrorBox error={new Error('Repository not found.')} />;
  } else {
    return (
      <>
        <SkipNavLink />
        <Header large={true} />
        <div className="pb-8 pb-48 px-3 md:px-6">
          <Wrap>
            <div className="md:-mt-32 -mt-24">
              <SkipNavContent />
              <h1 className="font-body text-md text-white mb-2">
                Latest Articles
              </h1>
              <div className="rounded-t-lg bg-white shadow-lg">
                <Posts repository={respository} />
              </div>
            </div>
          </Wrap>
        </div>
      </>
    );
  }
}

function LinkSection({
  iconSize = '2rem',
  white,
}: {
  iconSize?: string,
  white?: boolean,
}) {
  const colorClasses = white
    ? 'text-gray-800 hover:text-gray-200'
    : 'text-gray-400 hover:text-gray-800';

  const icons: Array<{icon: any, link: string, title: string}> = [
    {
      icon: (
        <svg
          version="1.1"
          id="Twitter"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          enable-background="new 0 0 20 20"
          width={iconSize}
          height={iconSize}
          style={{marginTop: -2.5}}
          className={
            'fill-current transition duration-300 ease-in-out ' + colorClasses
          }>
          <path
            d="M1,6h4v13H1V6z M3,1C1.8,1,1,2,1,3.1C1,4.1,1.8,5,3,5c1.3,0,2-0.9,2-2C5,1.9,4.2,1,3,1z M14.6,6.2
	c-2.1,0-3.3,1.2-3.8,2h-0.1l-0.2-1.7H6.9C6.9,7.6,7,8.9,7,10.4V19h4v-7.1c0-0.4,0-0.7,0.1-1c0.3-0.7,0.8-1.6,1.9-1.6
	c1.4,0,2,1.2,2,2.8V19h4v-7.4C19,7.9,17.1,6.2,14.6,6.2z"
          />
        </svg>
      ),
      link: 'https://www.linkedin.com/company/arizon/',
      title: 'Arizon on LinkedIn',
    },
    {
      icon: (
        <svg
          version="1.1"
          id="Twitter"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          enable-background="new 0 0 20 20"
          width={iconSize}
          height={iconSize}
          className={
            'fill-current transition duration-300 ease-in-out ' + colorClasses
          }>
          <path
            d="M17.316,6.246c0.008,0.162,0.011,0.326,0.011,0.488c0,4.99-3.797,10.742-10.74,10.742
	c-2.133,0-4.116-0.625-5.787-1.697c0.296,0.035,0.596,0.053,0.9,0.053c1.77,0,3.397-0.604,4.688-1.615
	c-1.651-0.031-3.046-1.121-3.526-2.621c0.23,0.043,0.467,0.066,0.71,0.066c0.345,0,0.679-0.045,0.995-0.131
	C2.84,11.183,1.539,9.658,1.539,7.828c0-0.016,0-0.031,0-0.047c0.509,0.283,1.092,0.453,1.71,0.473
	c-1.013-0.678-1.68-1.832-1.68-3.143c0-0.691,0.186-1.34,0.512-1.898C3.942,5.498,6.725,7,9.862,7.158
	C9.798,6.881,9.765,6.594,9.765,6.297c0-2.084,1.689-3.773,3.774-3.773c1.086,0,2.067,0.457,2.756,1.191
	c0.859-0.17,1.667-0.484,2.397-0.916c-0.282,0.881-0.881,1.621-1.66,2.088c0.764-0.092,1.49-0.293,2.168-0.594
	C18.694,5.051,18.054,5.715,17.316,6.246z"
          />
        </svg>
      ),
      link: 'https://twitter.com/arizon_ab',
      title: 'Arizon on Twitter',
    },
  ];

  return (
    <div className="flex">
      {icons.map((icon, i) => (
        <div key={i} className={i === 0 ? '' : ' ml-4'}>
          <a
            href={icon.link}
            title={icon.title}
            target="_blank"
            className="no-underline">
            {icon.icon}
          </a>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-16 py-10 md:mt-20 md:pb-32 md:pt-32 flex justify-center p-4 bg-gray-100">
      <div className="text-center flex flex-col">
        <a
          href="https://arizon.se"
          target="_blank"
          title="Click for more on Arizon">
          <img
            className="w-16 mx-auto"
            src={require('./assets/logo-symbol-black.svg')}
          />
        </a>
      </div>
    </div>
  );
}

export const postRootQuery = graphql`
  # repoName and repoOwner provided by fixedVariables
  query App_PostQuery(
    $issueNumber: Int!
    $repoName: String!
    $repoOwner: String!
  )
    @persistedQueryConfiguration(
      accessToken: {environmentVariable: "OG_GITHUB_TOKEN"}
      fixedVariables: {environmentVariable: "REPOSITORY_FIXED_VARIABLES"}
      freeVariables: ["issueNumber"]
      cacheSeconds: 300
    ) {
    gitHub {
      viewer {
        login
        name
        avatarUrl(size: 96)
        url
      }
      ...Avatar_gitHub @arguments(repoName: $repoName, repoOwner: $repoOwner)
      repository(name: $repoName, owner: $repoOwner) {
        issue(number: $issueNumber) {
          labels(first: 100) {
            nodes {
              name
            }
          }
          title
          id
          number
          ...Post_post
        }
      }
    }
  }
`;

function PostRoot({preloadedQuery}: {preloadedQuery: any}) {
  const data: App_PostQueryResponse = usePreloadedQuery<App_PostQueryResponse>(
    postRootQuery,
    preloadedQuery,
  );

  const post = data?.gitHub?.repository?.issue;
  const labels = post?.labels?.nodes;
  if (
    !data ||
    !data.gitHub ||
    !post ||
    !labels ||
    !labels.find(l => l && l.name.toLowerCase() === 'publish')
  ) {
    return <ErrorBox error={new Error('Missing post.')} />;
  } else {
    return (
      <>
        <Helmet>
          <title>{post.title}</title>
        </Helmet>
        <SkipNavLink />
        <Wrap>
          <Header />
          <SkipNavContent />
          <Post context="details" post={post} />
        </Wrap>
        <Footer />
      </>
    );
  }
}

function Wrap({children}: {children: any}) {
  return (
    <div className="relative w-full max-w-2xl m-auto break-words">
      {children}
    </div>
  );
}

const Route = React.memo(function Route({
  cache,
  routeConfig,
  environment,
  ...props
}) {
  const notificationContext = React.useContext(NotificationContext);
  const {loginStatus} = React.useContext(UserContext);
  return (
    <>
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <routeConfig.component
            key={loginStatus === 'logged-in' ? 'logged-in' : 'logged-out'}
            preloadedQuery={routeConfig.preload(cache, environment, {
              ...props,
              notificationContext,
            })}
          />
        </React.Suspense>
      </ErrorBoundary>
    </>
  );
});

function makeRoute({path, query, getVariables, component}) {
  return {
    path,
    query,
    getVariables,
    component,
    preload(cache: PreloadCache, environment: Environment, props: any) {
      const preloadedQuery = cache.get(
        environment,
        query,
        getVariables(props),
        {
          fetchPolicy: 'store-and-network',
        },
      );
      if (props.notificationContext) {
        try {
          preloadedQuery.source.subscribe({
            complete: () => {
              props.notificationContext.clearCorsViolation();
            },
            error: e => {
              if (e.type === 'missing-cors') {
                props.notificationContext.setCorsViolation();
              }
            },
          });
        } catch (e) {
          console.error('error in cors check', e);
        }
      }
      return preloadedQuery;
    },
  };
}

const postsRoute = makeRoute({
  path: '/',
  query: postsRootQuery,
  getVariables(props: any) {
    return {};
  },
  component: PostsRoot,
});

export const postRoute = makeRoute({
  path: '/post/:issueNumber/:slug?',
  query: postRootQuery,
  getVariables(props: any) {
    return {
      issueNumber: parseInt(props.issueNumber, 10),
    };
  },
  component: PostRoot,
});

const postRouteNoSlug = {...postRoute, path: '/post/:issueNumber'};

export const routes = [postsRoute, postRoute, postRouteNoSlug];

function shouldUpdateScroll(prevRouterProps, {location}) {
  const {pathname, hash} = location;

  if (prevRouterProps) {
    const {
      location: {pathname: oldPathname},
    } = prevRouterProps;
    if (oldPathname === pathname) {
      // Scroll to element if it exists, if it doesn't, or no hash is provided,
      // scroll to top.
      return hash ? decodeURI(hash.slice(1)) : [0, 0];
    }
  }
  return true;
}

function ScrollContextWrapper({location, children}) {
  if (typeof window === 'undefined') {
    return children;
  }
  return (
    <ScrollContext location={location} shouldUpdateScroll={shouldUpdateScroll}>
      {children}
    </ScrollContext>
  );
}

export default function App({
  environment,
  basepath,
}: {
  environment: Environment,
  basepath: string,
}) {
  const [loginStatus, setLoginStatus] = React.useReducer(
    (_state, newState) => newState,
    'checking',
  );

  const cache = React.useContext(PreloadCacheContext);

  React.useEffect(() => {
    onegraphAuth
      .isLoggedIn('github')
      .then(isLoggedIn => {
        setLoginStatus(isLoggedIn ? 'logged-in' : 'logged-out');
      })
      .catch(e => {
        console.error('Error checking login status', e);
        setLoginStatus('error');
      });
  }, []);

  const login = () => {
    onegraphAuth.login('github').then(() =>
      onegraphAuth.isLoggedIn('github').then(isLoggedIn => {
        cache.clear(environment);
        setLoginStatus(isLoggedIn ? 'logged-in' : 'logged-out');
      }),
    );
  };
  const logout = () => {
    onegraphAuth.logout('github').then(() =>
      onegraphAuth.isLoggedIn('github').then(isLoggedIn => {
        cache.clear(environment);
        onegraphAuth.destroy();
        setLoginStatus(isLoggedIn ? 'logged-in' : 'logged-out');
      }),
    );
  };

  return (
    <RelayEnvironmentProvider environment={environment}>
      <UserContext.Provider
        value={{
          loginStatus,
          login,
          logout,
        }}>
        <Helmet
          defaultTitle={config.title}
          titleTemplate={'%s' + (config.title ? ' - ' + config.title : '')}>
          {config.description ? (
            <meta name="description" content={config.description} />
          ) : null}
          <meta charSet="utf-8" />
        </Helmet>
        <NotificationContainer>
          <Grommet theme={theme}>
            <Location>
              {({location}) => (
                <ScrollContextWrapper location={location}>
                  <Router primary={true} basepath={basepath}>
                    {routes.map((routeConfig, i) => (
                      <Route
                        key={i}
                        path={routeConfig.path}
                        environment={environment}
                        cache={cache}
                        routeConfig={routeConfig}
                      />
                    ))}
                  </Router>
                </ScrollContextWrapper>
              )}
            </Location>
          </Grommet>
        </NotificationContainer>
      </UserContext.Provider>
    </RelayEnvironmentProvider>
  );
}
