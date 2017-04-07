export const selectRoom = (getState, roomId) => getState().getIn(['rooms', roomId]);

// Game:

export const selectGame = (getState, gameId) =>
  getState().getIn(['games', gameId]);

export const selectPlayers4Sockets = (getState, gameId) => {
  const roomId = selectGame(getState, gameId).roomId;
  return [].concat(
    selectRoom(getState, roomId).users.valueSeq().toArray()
    , selectRoom(getState, roomId).spectators.valueSeq().toArray()
  );
};

export const selectPlayer = (getState, gameId, user) =>
  selectGame(getState, gameId).getPlayer(user);

export const selectCard = (getState, gameId, user, cardIndex) =>
  selectGame(getState, gameId).getPlayer(user).getCard(cardIndex);

export const selectAnimal = (getState, gameId, user, animalIndex) =>
  selectGame(getState, gameId).getPlayer(user).getAnimal(animalIndex);

export const selectTrait = (getState, gameId, user, animalIndex, traitIndex) =>
  selectGame(getState, gameId).getPlayer(user).getAnimal(animalIndex).getIn(['traits', traitIndex]);

export const makeGameSelectors = (getState, gameId) => ({
  selectGame: () => selectGame(getState, gameId)
  , selectPlayer: (user) => selectPlayer(getState, gameId, user)
  , selectCard: (user, cardIndex) => selectCard(getState, gameId, user, cardIndex)
  , selectAnimal: (user, animalIndex) => selectAnimal(getState, gameId, user, animalIndex)
  , selectTrait: (user, animalIndex, traitIndex) => selectTrait(getState, gameId, user, animalIndex, traitIndex)
  , selectQuestionId: () => getState().getIn(['games', gameId, 'question', 'id'])
});