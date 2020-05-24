// @flow

import React from 'react';
import graphql from 'babel-plugin-relay/macro';
import {createPaginationContainer, type RelayProp} from 'react-relay';
import Post from './Post';
import type {Posts_repository} from './__generated__/Posts_repository.graphql';
import LoadingSpinner from './loadingSpinner';
import {Box} from 'grommet/components/Box';

type Props = {|
  relay: RelayProp,
  repository: Posts_repository,
|};

// TODO: pagination. Can do pages or infinite scroll
const Posts = ({relay, repository}: Props) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const scheduledRef = React.useRef(false);
  const handleScroll = React.useCallback(() => {
    if (!scheduledRef.current) {
      scheduledRef.current = true;
      window.requestAnimationFrame(() => {
        scheduledRef.current = false;
        if (
          window.innerHeight + document.documentElement?.scrollTop >=
          (document.documentElement?.offsetHeight || 0) - 500
        ) {
          if (!isLoading && !relay.isLoading() && relay.hasMore()) {
            setIsLoading(true);
            relay.loadMore(10, x => {
              setIsLoading(false);
            });
          }
        }
      });
    }
  }, [relay, isLoading, setIsLoading]);
  React.useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const issues = repository.issues.edges || [];

  return (
    <div className="pt-1">
      <ul className="list-none p-0">
        {issues.map((e, i) =>
          e && e.node ? (
            <li key={e.node.id}>
              {i > 0 ? (
                <hr
                  className="mb-6 border-gray-300 mx-4"
                  style={{height: '1px'}}
                />
              ) : null}
              <Post context="list" post={e.node} isFirstPost={i === 0} />
            </li>
          ) : null,
        )}
      </ul>

      {isLoading ? (
        <Box
          align="center"
          margin="medium"
          style={{
            maxWidth: 704,
          }}>
          <LoadingSpinner width="48px" height="48px" />
        </Box>
      ) : null}
    </div>
  );
};

export default createPaginationContainer(
  Posts,
  {
    repository: graphql`
      fragment Posts_repository on GitHubRepository
        @argumentDefinitions(
          count: {type: "Int", defaultValue: 10}
          cursor: {type: "String"}
          orderBy: {
            type: "GitHubIssueOrder"
            defaultValue: {direction: DESC, field: CREATED_AT}
          }
          labels: {type: "[String!]!", defaultValue: ["publish", "Publish"]}
        ) {
        issues(
          first: $count
          after: $cursor
          orderBy: $orderBy
          labels: $labels
        ) @connection(key: "Posts_posts_issues") {
          edges {
            node {
              id
              ...Post_post
            }
          }
        }
      }
    `,
  },
  {
    direction: 'forward',
    getConnectionFromProps(props) {
      return props.repository && props.repository.issues;
    },
    getVariables(props, {count, cursor}, fragmentVariables) {
      return {
        count: count,
        cursor,
        orderBy: fragmentVariables.orderBy,
      };
    },

    query: graphql`
      # repoName and repoOwner provided by fixedVariables
      query PostsPaginationQuery(
        $count: Int!
        $cursor: String
        $orderBy: GitHubIssueOrder
        $repoOwner: String!
        $repoName: String!
      )
        @persistedQueryConfiguration(
          accessToken: {environmentVariable: "OG_GITHUB_TOKEN"}
          freeVariables: ["count", "cursor", "orderBy"]
          fixedVariables: {environmentVariable: "REPOSITORY_FIXED_VARIABLES"}
          cacheSeconds: 300
        ) {
        gitHub {
          repository(name: $repoName, owner: $repoOwner) {
            __typename
            ...Posts_repository
              @arguments(count: $count, cursor: $cursor, orderBy: $orderBy)
          }
        }
      }
    `,
  },
);
