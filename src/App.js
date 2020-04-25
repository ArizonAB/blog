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
        'mt-8 md:mt-10 mb-4 md:mb-8 text-center flex px-6 ' +
        (large ? 'justify-center items-center flex-col' : '')
      }
      style={large ? {height: '70vh'} : {}}>
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
          src={require('./assets/logo.svg')}
          alt="Arizon AB"
          className={large ? 'h-20 mx-auto' : 'h-10'}
        />
      </Link>

      {large ? <LinkSection iconSize="1.5rem" /> : null}
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
        <div className="bg-gray-100 py-8 pb-48 px-6">
          <Wrap>
            <SkipNavContent />
            <h1 className="font-body text-md text-gray-900 uppercase">
              Latest Articles
            </h1>
            <Posts repository={respository} />
          </Wrap>
        </div>
      </>
    );
  }
}

function LinkSection({iconSize = '2rem'}: {iconSize?: string}) {
  const icons: Array<{icon: any, link: string, title: string}> = [
    {
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={iconSize}
          height={iconSize}
          className="fill-current text-gray-400 hover:text-gray-800 transition duration-300 ease-in-out"
          viewBox="0 0 24 24">
          <path d="M0 0v24h24v-24h-24zm8 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.397-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
      ),
      link: 'https://www.linkedin.com/company/arizon/',
      title: 'Arizon on LinkedIn',
    },
    {
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={iconSize}
          height={iconSize}
          className="fill-current text-gray-400 hover:text-gray-800 transition duration-300 ease-in-out"
          viewBox="0 0 24 24">
          <path d="M0 0v24h24v-24h-24zm18.862 9.237c.208 4.617-3.235 9.765-9.33 9.765-1.854 0-3.579-.543-5.032-1.475 1.742.205 3.48-.278 4.86-1.359-1.437-.027-2.649-.976-3.066-2.28.515.098 1.021.069 1.482-.056-1.579-.317-2.668-1.739-2.633-3.26.442.246.949.394 1.486.411-1.461-.977-1.875-2.907-1.016-4.383 1.619 1.986 4.038 3.293 6.766 3.43-.479-2.053 1.079-4.03 3.198-4.03.944 0 1.797.398 2.396 1.037.748-.147 1.451-.42 2.085-.796-.245.767-.766 1.41-1.443 1.816.664-.08 1.297-.256 1.885-.517-.44.656-.997 1.234-1.638 1.697z" />
        </svg>
      ),
      link: 'https://twitter.com/arizon_ab',
      title: 'Arizon on Twitter',
    },
    {
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={iconSize}
          height={iconSize}
          className="fill-current text-gray-400 hover:text-gray-800 transition duration-300 ease-in-out"
          viewBox="0 0 24 24">
          <path d="M21 13v10h-6v-6h-6v6h-6v-10h-3l12-12 12 12h-3zm-1-5.907v-5.093h-3v2.093l3 3z" />
        </svg>
      ),
      link: 'https://arizon.se',
      title: "Arizon's website",
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
    <div className="mt-16 py-10 md:mt-20 md:pb-56 md:pt-56 flex justify-center p-4 bg-gray-100">
      <div className="text-center flex flex-col">
        <Link to="/">
          <img
            className="w-16 mx-auto"
            src={require('./assets/logo-symbol-black.svg')}
          />
        </Link>
        <div className="mt-3">
          <LinkSection iconSize="1.5rem" />
        </div>
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
