export interface ITweet {
  text: string;
  username: string;
  timestamp: string;
  tweetId: string;
  mediaUrls: string[];
  likes: number;
  retweets: number;
  comments: number;
  hasVideo: boolean;
}

export interface ITweetAttributes {
    id: string;
    tweet_text: string;
    author: string;
    likes: number;
    retweets: number;
    comments: number;
    createdAt?: Date;
    updatedAt?: Date;
  }