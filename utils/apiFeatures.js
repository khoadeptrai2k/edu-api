class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  paginating(defaultLimit = 9, maxLimit = 50) {
    const page = Math.max(Number(this.queryString.page) || 1, 1);
    const requestedLimit = Number(this.queryString.limit) || defaultLimit;
    const limit = Math.min(Math.max(requestedLimit, 1), maxLimit);
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
