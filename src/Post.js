// @flow

import * as React from 'react';
import graphql from 'babel-plugin-relay/macro';
import {
  createFragmentContainer,
  commitMutation,
  fetchQuery,
  type RelayProp,
} from 'react-relay';
import {useRelayEnvironment} from 'react-relay/hooks';
import MarkdownRenderer from './MarkdownRenderer';
import formatDate from 'date-fns/format';
import EmojiIcon from './emojiIcon';
import AddIcon from './addIcon';
import Tippy, {TippyGroup} from '@tippy.js/react';
import 'tippy.js/themes/light-border.css';
import Link from './PreloadLink';
import {postRoute} from './App';
import GitHubLoginButton from './GitHubLoginButton';
import {NotificationContext} from './Notifications';
import {Box} from 'grommet/components/Box';
import {Heading} from 'grommet/components/Heading';
import {Text} from 'grommet/components/Text';
import UserContext from './UserContext';
import {lowerCase} from 'lower-case';
import {sentenceCase} from 'sentence-case';
import unified from 'unified';
import parse from 'remark-parse';
import imageUrl from './imageUrl';
import {Helmet} from 'react-helmet';
import PreloadCacheContext from './PreloadCacheContext';
import * as throttle from 'lodash.throttle';
import * as debounce from 'lodash.debounce';
import {Progress} from './Progress';
import {extractFirstImage, extractFirstText} from './markdownUtils';

import type {Post_post} from './__generated__/Post_post.graphql';

// n.b. no accessToken in the persistedQueryConfiguration for these mutations,
// because we want to add reactions on behalf of the logged-in user, not the
// persisted auth
const addReactionMutation = graphql`
  mutation Post_AddReactionMutation($input: GitHubAddReactionInput!)
    @persistedQueryConfiguration(freeVariables: ["input"]) {
    gitHub {
      addReaction(input: $input) {
        reaction {
          content
          user {
            login
            name
          }
          reactable {
            ... on GitHubIssue {
              ...Post_post
            }
            ... on GitHubComment {
              ...Comment_comment
            }
          }
        }
      }
    }
  }
`;

const removeReactionMutation = graphql`
  mutation Post_RemoveReactionMutation($input: GitHubRemoveReactionInput!)
    @persistedQueryConfiguration(freeVariables: ["input"]) {
    gitHub {
      removeReaction(input: $input) {
        reaction {
          content
          user {
            login
            name
          }
          reactable {
            ... on GitHubIssue {
              ...Post_post
            }
            ... on GitHubComment {
              ...Comment_comment
            }
          }
        }
      }
    }
  }
`;

function reactionUpdater({store, viewerHasReacted, subjectId, content}) {
  const reactionGroup = store
    .get(subjectId)
    .getLinkedRecords('reactionGroups')
    .find(r => r.getValue('content') === content);
  reactionGroup.setValue(viewerHasReacted, 'viewerHasReacted');
  const users = reactionGroup.getLinkedRecord('users', {first: 11});
  users.setValue(
    Math.max(0, users.getValue('totalCount') + (viewerHasReacted ? 1 : -1)),
    'totalCount',
  );
}

async function addReaction({environment, content, subjectId}) {
  const variables = {
    input: {
      content,
      subjectId,
    },
  };
  return new Promise((resolve, reject) => {
    commitMutation(environment, {
      mutation: addReactionMutation,
      variables,
      onCompleted: (response, errors) => resolve({response, errors}),
      onError: err => reject(err),
      optimisticUpdater: store =>
        reactionUpdater({store, viewerHasReacted: true, content, subjectId}),
    });
  });
}

async function removeReaction({environment, content, subjectId}) {
  const variables = {
    input: {
      content,
      subjectId,
    },
  };
  return new Promise((resolve, reject) => {
    commitMutation(environment, {
      mutation: removeReactionMutation,
      variables,
      onCompleted: (response, errors) => resolve({response, errors}),
      onError: err => reject(err),
      optimisticUpdater: store =>
        reactionUpdater({store, viewerHasReacted: false, content, subjectId}),
    });
  });
}

function emojiForContent(content) {
  switch (content) {
    case 'THUMBS_UP':
      return '👍';
    case 'THUMBS_DOWN':
      return '👎';
    case 'LAUGH':
      return '😄';
    case 'HOORAY':
      return '🎉';
    case 'CONFUSED':
      return '😕';
    case 'HEART':
      return '❤️';
    case 'ROCKET':
      return '🚀';
    case 'EYES':
      return '👀';
    default:
      return null;
  }
}

const reactions = [
  'THUMBS_UP',
  'THUMBS_DOWN',
  'LAUGH',
  'HOORAY',
  'CONFUSED',
  'HEART',
  'ROCKET',
  'EYES',
];

const EmojiPicker = ({
  viewerReactions,
  onSelect,
  onDeselect,
  isLoggedIn,
  login,
}) => {
  const reactionContent = reaction => {
    const isSelected = viewerReactions.includes(reaction);
    return (
      <button
        style={{
          cursor: 'pointer',
          outline: 'none',
          fontSize: 20,
          padding: '0 5px',
          backgroundColor: isSelected ? '#ddefff' : 'transparent',
          border: isSelected ? '1px solid #e1e4e8' : '1px solid transparent',
        }}
        key={reaction}
        onClick={() =>
          isSelected ? onDeselect(reaction) : onSelect(reaction)
        }>
        <span role="img">{emojiForContent(reaction)}</span>
      </button>
    );
  };
  return (
    <>
      <p style={{textAlign: 'left', margin: '5px 0 0'}}>Pick your reaction</p>
      <div style={{height: 1, background: '#ddd', margin: '5px 0'}} />
      {isLoggedIn ? (
        <>
          <div>
            {reactions.slice(0, 4).map(reaction => reactionContent(reaction))}
          </div>
          <div>
            {reactions.slice(4).map(reaction => reactionContent(reaction))}
          </div>
        </>
      ) : (
        <GitHubLoginButton onClick={login} />
      )}
    </>
  );
};

type Props = {
  relay: RelayProp,
  post: Post_post,
  context: 'list' | 'details',
  isFirstPost?: boolean,
};

export function PostBox({children}: {children: React.Node}) {
  return (
    <Box
      pad="medium"
      style={{
        maxWidth: 704,
        width: '100%',
        borderRadius: 2,
      }}>
      {children}
    </Box>
  );
}

export const ReactionBar = ({
  reactionGroups,
  subjectId,
  pad,
}: {
  reactionGroups: *,
  subjectId: string,
  pad?: string,
}) => {
  const environment = useRelayEnvironment();
  const {error: notifyError} = React.useContext(NotificationContext);
  const [showReactionPopover, setShowReactionPopover] = React.useState(false);
  const popoverInstance = React.useRef();
  const {loginStatus, login} = React.useContext(UserContext);
  const isLoggedIn = loginStatus === 'logged-in';

  const usedReactions = (reactionGroups || []).filter(
    g => g.users.totalCount > 0,
  );

  return (
    <Box
      pad={pad || 'xsmall'}
      direction="row"
      wrap={true}
      border={{size: 'xsmall', side: 'top', color: 'rgba(0,0,0,0.1)'}}>
      <TippyGroup delay={500}>
        {usedReactions.map(g => {
          const total = g.users.totalCount;
          const reactors = (g.users.nodes || []).map(x =>
            x ? x.name || x.login : null,
          );
          if (total > 11) {
            reactors.push(`${total - 11} more`);
          }

          const reactorsSentence = [
            ...reactors.slice(0, reactors.length - 2),
            reactors.slice(-2).join(reactors.length > 2 ? ', and ' : ' and '),
          ].join(', ');

          return (
            <Tippy
              key={g.content}
              arrow={true}
              trigger="mouseenter focus click"
              placement="bottom"
              flipBehavior={['bottom', 'right']}
              theme="light-border"
              inertia={true}
              interactive={true}
              animateFill={false}
              interactiveBorder={10}
              duration={[75, 75]}
              content={
                <div>
                  {reactorsSentence} reacted with{' '}
                  {lowerCase(sentenceCase(g.content))} emoji
                </div>
              }>
              <span
                key={g.content}
                style={{
                  padding: '0 16px',
                  borderRight: '1px solid rgba(0,0,0,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                <Text>{emojiForContent(g.content)} </Text>
                <Text size="small" style={{marginLeft: 8}}>
                  {g.users.totalCount}
                </Text>
              </span>
            </Tippy>
          );
        })}
      </TippyGroup>
      <Tippy
        onCreate={instance => (popoverInstance.current = instance)}
        arrow={true}
        trigger="click"
        theme="light-border"
        inertia={true}
        interactive={true}
        animateFill={false}
        interactiveBorder={10}
        duration={[300, 75]}
        content={
          <div>
            <EmojiPicker
              isLoggedIn={isLoggedIn}
              login={login}
              viewerReactions={usedReactions
                .filter(x => x.viewerHasReacted)
                .map(x => x.content)}
              onDeselect={async content => {
                popoverInstance.current && popoverInstance.current.hide();
                try {
                  await removeReaction({
                    environment,
                    content,
                    subjectId,
                  });
                } catch (e) {
                  notifyError('Error removing reaction.');
                }
              }}
              onSelect={async content => {
                popoverInstance.current && popoverInstance.current.hide();
                try {
                  await addReaction({
                    environment,
                    content,
                    subjectId,
                  });
                } catch (e) {
                  notifyError('Error adding reaction.');
                }
              }}
            />
          </div>
        }>
        <span
          style={{padding: '8px 16px'}}
          className="add-reaction-emoji"
          onClick={() => setShowReactionPopover(!showReactionPopover)}>
          <AddIcon width="12" />
          <EmojiIcon
            width="24"
            style={{marginLeft: 2, stroke: 'rgba(0,0,0,0)'}}
          />
        </span>
      </Tippy>
    </Box>
  );
};

function slugify(s: string): string {
  return lowerCase(s)
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .trimStart() // Trim from start of text
    .trimEnd(); // Trim from end of text
}

export function postPath({
  post,
  viewComments,
}: {
  post: {
    +number: number,
    +repository: {+owner: {+login: string}, +name: string},
    +title: string,
  },
  viewComments?: boolean,
}) {
  return `/post/${post.number}/${slugify(post.title)}${
    viewComments ? '#comments' : ''
  }`;
}

const markdownParser = unified().use(parse);

function visitBackmatter(node, fn) {
  if (node.type === 'code' && node.lang === 'backmatter') {
    fn(node);
  }
  if (node.children && node.children.length) {
    for (const child of node.children) {
      visitBackmatter(child, fn);
    }
  }
}

function postBackmatter(post) {
  const backmatter = {};
  const ast = markdownParser.parse(post.body);
  visitBackmatter(ast, node => {
    try {
      Object.assign(backmatter, JSON.parse(node.value));
    } catch (e) {
      console.error('Error visiting backmatter', e);
    }
  });
  return backmatter;
}

export function computePostDate(post: {
  +body: string,
  +createdAt: string,
}): Date {
  const backmatter = postBackmatter(post);
  if (backmatter.publishedDate) {
    return new Date(backmatter.publishedDate);
  }
  return new Date(post.createdAt);
}

function extractTwitterHandle(url: string): ?string {
  if (
    url.indexOf('https://twitter.com') === 0 ||
    url.indexOf('https://www.twitter.com') === 0
  ) {
    const handle = url.split('/').pop();
    return handle;
  }
}

export const Post = ({relay, post, context, isFirstPost}: Props) => {
  const firstImg = React.useMemo(() => extractFirstImage(post.body), [
    post.body,
  ]);
  const firstText = React.useMemo(() => extractFirstText(post.body), [
    post.body,
  ]);

  const environment = useRelayEnvironment();
  const cache = React.useContext(PreloadCacheContext);
  React.useEffect(() => {
    if (context === 'list') {
      postRoute.preload(cache, environment, {issueNumber: post.number});
    }
  }, [cache, environment, context]);
  const {error: notifyError} = React.useContext(NotificationContext);
  const [showReactionPopover, setShowReactionPopover] = React.useState(false);
  const postDate = React.useMemo(() => computePostDate(post), [post]);
  const popoverInstance = React.useRef();
  const {loginStatus, login} = React.useContext(UserContext);
  const isLoggedIn = loginStatus === 'logged-in';

  const contentSectionRef = React.useRef<?HTMLElement>(null);

  const [hasCalculated, setHasCalculated] = React.useState<boolean>(false);
  const [contentHeight, setContentHeight] = React.useState<number>(0);

  React.useEffect(() => {
    const calculateBodySize = throttle(() => {
      const contentSection = contentSectionRef.current;

      if (!contentSection) return;

      /**
       * If we haven't checked the content's height before,
       * we want to add listeners to the content area's
       * imagery to recheck when it's loaded
       */
      if (!hasCalculated) {
        const debouncedCalculation = debounce(calculateBodySize);
        const $imgs = contentSection.querySelectorAll('img');

        $imgs.forEach($img => {
          // If the image hasn't finished loading then add a listener
          if ($img instanceof HTMLImageElement && !$img.complete) {
            $img.onload = debouncedCalculation;
          }
        });

        // Prevent rerun of the listener attachment
        setHasCalculated(true);
      }

      // Set the height and offset of the content area
      setContentHeight(contentSection.getBoundingClientRect().height);
    }, 20);

    calculateBodySize();
    window.addEventListener('resize', calculateBodySize);

    return () => window.removeEventListener('resize', calculateBodySize);
  }, []);

  const authors = post.assignees.nodes || [];
  const HeadingEl = context === 'list' ? 'h2' : 'h1';

  return (
    <article className={context === 'list' ? 'bg-white my-2' : ''}>
      <Helmet>
        {firstImg ? <meta property="og:image" content={firstImg.url} /> : null}
        {firstText ? <meta name="description" content={firstText} /> : null}
      </Helmet>
      <header
        className={
          'leading-none ' +
          (context === 'list' ? 'p-4 pt-2' : 'p-6 pb-0') +
          (context === 'list' && isFirstPost ? '' : ' flex items-center')
        }>
        {firstImg && context === 'list' ? (
          <div
            style={{
              backgroundImage: 'url(' + firstImg.url + ')',
              height: isFirstPost ? '30vh' : undefined,
            }}
            className={
              'bg-cover bg-center bg-no-repeat shadow-lg mb-4 ' +
              (isFirstPost ? 'w-full' : 'w-32 h-32 mr-4')
            }
          />
        ) : null}
        <div>
          <HeadingEl
            className={
              'font-display font-bold leading-none md:leading-tight text-gray-900 ' +
              (context === 'list' ? 'text-2xl' : 'text-4xl')
            }>
            {context === 'details' ? (
              post.title
            ) : (
              <Link style={{color: 'inherit'}} to={postPath({post})}>
                {post.title}
              </Link>
            )}
          </HeadingEl>
          <div className="text-gray-700 uppercase text-sm mt-2 md:mt-0">
            {formatDate(postDate, 'MMM do, yyyy')}
          </div>

          {authors.length > 0 ? (
            <div className={'flex mt-4 ' + (context === 'list' ? 'pb-2' : '')}>
              {authors.map((node, i) => {
                const handle =
                  node && node.websiteUrl
                    ? extractTwitterHandle(node.websiteUrl)
                    : null;

                return node ? (
                  <div className="flex items-center mr-2">
                    <img
                      className="h-8 rounded-full shadow-lg w-8"
                      alt={node.name}
                      src={imageUrl({src: node.avatarUrl})}
                    />
                    <div className="flex flex-col ml-3 text-gray-800 font-semibold leading-tight">
                      <a href={node.url} target="_blank">
                        {node.name || node.login}
                      </a>
                      {handle ? (
                        <a
                          className="text-sm text-gray-600"
                          target="_blank"
                          title={`${node.name || node.login} on Twitter`}
                          href={node.websiteUrl}>
                          @{handle}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          ) : null}
        </div>
      </header>

      {post.body && context === 'details' ? (
        <>
          <div
            className="fixed flex translate-y-0 align-center z-10"
            style={{
              height: '100vh',
              top: '20%',
              left: 'calc(50% - 26rem)',
            }}>
            <Progress contentHeight={contentHeight} />
          </div>
          <div
            className="font-body leading-normal mt-6 md:mt-8"
            ref={contentSectionRef}>
            <MarkdownRenderer escapeHtml={true} source={post.body} />
          </div>
          {authors.length > 0 ? (
            <>
              <footer className="px-6">
                <hr
                  className="mt-10 mb-6 border-gray-300"
                  style={{height: '1px'}}
                />
                <div className="mt-10 font-body font-sm mb-4 text-gray-700">
                  Written By
                </div>
                <div className="flex">
                  {authors.map((node, i) => {
                    const handle =
                      node && node.websiteUrl
                        ? extractTwitterHandle(node.websiteUrl)
                        : null;

                    return node ? (
                      <div className="flex items-center mr-2">
                        <img
                          className="h-16 rounded-full shadow-lg w-16"
                          alt={node.name}
                          src={imageUrl({src: node.avatarUrl})}
                        />
                        <div className="flex flex-col ml-3 text-gray-800 font-semibold leading-tight">
                          <a href={node.url} target="_blank">
                            {node.name || node.login}
                          </a>
                          {handle ? (
                            <a
                              className="text-sm text-gray-600"
                              target="_blank"
                              title={`${node.name || node.login} on Twitter`}
                              href={node.websiteUrl}>
                              @{handle}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </footer>
            </>
          ) : null}
        </>
      ) : null}
    </article>
  );
};

export default createFragmentContainer(Post, {
  post: graphql`
    fragment Post_post on GitHubIssue {
      id
      number
      title
      body
      createdAt
      updatedAt
      assignees(first: 10) {
        nodes {
          id
          name
          login
          avatarUrl(size: 96)
          url
          websiteUrl
        }
      }
      commentsCount: comments {
        totalCount
      }
      repository {
        name
        owner {
          login
          avatarUrl(size: 96)
        }
      }
    }
  `,
});
