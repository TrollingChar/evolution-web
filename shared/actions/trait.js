import logger from '~/shared/utils/logger';
import {ActionCheckError} from '~/shared/models/ActionCheckError';
import {List} from 'immutable';

import {GameModel, GameModelClient, PHASE} from '../models/game/GameModel';
import {CooldownList} from '../models/game/CooldownList';
import {
  FOOD_SOURCE_TYPE
  , TRAIT_TARGET_TYPE
  , TRAIT_COOLDOWN_DURATION
  , TRAIT_COOLDOWN_PLACE
  , TRAIT_COOLDOWN_LINK
} from '../models/game/evolution/constants';

import {selectRoom, selectGame, selectPlayers} from '../selectors';

import {
  checkGameDefined
  , checkGameHasUser
  , checkPlayerHasCard
  , checkPlayerHasAnimal
  , checkPlayerTurnAndPhase
  , checkValidAnimalPosition
} from './checks';

/*
 * Activation
 * */

export const traitTakeFoodRequest = (animalId) => (dispatch, getState) => dispatch({
  type: 'traitTakeFoodRequest'
  , data: {gameId: getState().get('game').id, animalId}
  , meta: {server: true}
});

export const traitActivateRequest = (animalId, traitType, targetId) => (dispatch, getState) => dispatch({
  type: 'traitActivateRequest'
  , data: {gameId: getState().get('game').id, animalId, traitType, targetId}
  , meta: {server: true}
});

/*
 * simpleActions
 * */

const traitMoveFood = (gameId, animalId, amount, sourceType, sourceId) => ({
  type: 'traitMoveFood'
  , data: {gameId, animalId, amount, sourceType, sourceId}
});

const traitKillAnimal = (gameId, sourcePlayerId, sourceAnimalId, targetPlayerId, targetAnimalId) => ({
  type: 'traitKillAnimal'
  , data: {gameId, sourcePlayerId, sourceAnimalId, targetPlayerId, targetAnimalId}
});

export const server$traitKillAnimal = (gameId, sourcePlayerId, sourceAnimalId, targetPlayerId, targetAnimalId) => (dispatch, getState) => dispatch(
  Object.assign(traitKillAnimal(gameId, sourcePlayerId, sourceAnimalId, targetPlayerId, targetAnimalId)
    , {meta: {users: selectPlayers(getState, gameId)}}));

const executeFeeding = (gameId, actionsList) => ({
  type: 'executeFeeding'
  , data: {gameId, actionsList}
});

/*
 * complexActions
 * */

const client$executeFeeding = (gameId, actionsList) => (dispatch, getState) => {
  //actionsList.reduce((result, action) => {
  //  return result.then(dispatch(action))
  //}, Promise.resolve());
  //console.log('client$executeFeeding', actionsList)
  actionsList.forEach((action) => {
    dispatch(action);
  });
};

export const server$executeFeeding = (gameId, actionsList) => (dispatch, getState) => {
  actionsList.forEach((action) => {
    dispatch(action);
  });
  dispatch(Object.assign(executeFeeding(gameId, actionsList), {
    meta: {clientOnly: true, users: selectPlayers(getState, gameId)}
  }));
};

export const server$startFeeding = (gameId, animal, amount, sourceType, sourceId) => (dispatch, getState) => {
  const game = selectGame(getState, gameId);
  const actionsList = [];
  const requiredAmount = (animal.getMaxFood() + animal.getMaxFat()) - (animal.getFood() + animal.getFat());
  actionsList.push(traitMoveFood(gameId, animal.id, Math.min(amount, requiredAmount), sourceType, sourceId)); // TODO bug with 2 amount on animal 2/3
  dispatch(server$executeFeeding(gameId, actionsList));
};

/*
 * Cooldowns
 * */

export const startCooldown = (gameId, link, duration, place, placeId) => ({
  type: 'startCooldown'
  , data: {gameId, link, duration, place, placeId}
});

export const server$startCooldown = (gameId, link, duration, place, placeId) => (dispatch, getState) => dispatch(
  Object.assign(startCooldown(gameId, link, duration, place, placeId), {
    meta: {users: selectPlayers(getState, gameId)}
  }));

/*
 * traitClientToServer
 * */

export const traitClientToServer = {
  traitTakeFoodRequest: ({gameId, animalId}, {user: {id: userId}}) => (dispatch, getState) => {
    const game = selectGame(getState, gameId);
    checkGameDefined(game);
    checkGameHasUser(game, userId);
    checkPlayerTurnAndPhase(game, userId, PHASE.FEEDING);
    const animal = checkPlayerHasAnimal(game, userId, animalId);
    if (game.food < 1) {
      throw new ActionCheckError(`traitTakeFoodRequest@Game(${gameId})`, 'Not enough food (%s)', game.food)
    }
    if (game.cooldowns.checkFor(TRAIT_COOLDOWN_LINK.EATING, userId, animalId)) {
      throw new ActionCheckError(`traitTakeFoodRequest@Game(${gameId})`, 'Cooldown active')
    }
    if (!animal.canEat()) {
      throw new ActionCheckError(`traitTakeFoodRequest@Game(${gameId})`, 'Animal(%s) full', animal)
    }

    dispatch(server$startCooldown(gameId, TRAIT_COOLDOWN_LINK.EATING, TRAIT_COOLDOWN_DURATION.ROUND, TRAIT_COOLDOWN_PLACE.PLAYER, userId));
    dispatch(server$startCooldown(gameId, 'TraitCarnivorous', TRAIT_COOLDOWN_DURATION.ROUND, TRAIT_COOLDOWN_PLACE.PLAYER, userId));

    dispatch(server$startFeeding(gameId, animal, 1, FOOD_SOURCE_TYPE.GAME));
  }
  , traitActivateRequest: ({gameId, animalId, traitType, targetId}, {user: {id: userId}}) => (dispatch, getState) => {
    const game = selectGame(getState, gameId);
    checkGameDefined(game);
    checkGameHasUser(game, userId);
    checkPlayerTurnAndPhase(game, userId, PHASE.FEEDING);
    const sourceAnimal = checkPlayerHasAnimal(game, userId, animalId);
    const trait = sourceAnimal.traits.find(trait => trait.type === traitType);
    if (!trait) {
      throw new ActionCheckError(`traitActivateRequest@Game(${gameId})`, 'Animal(%s) doesnt have Trait(%s)', animalId, traitType)
    }
    const traitData = trait.dataModel;
    if (traitData.cooldowns && traitData.cooldowns.some(([link, place]) =>
        game.cooldowns.checkFor(link, userId, animalId))) {
      throw new ActionCheckError(`traitActivateRequest@Game(${gameId})`, 'Animal(%s):Trait(%s) has cooldown active', animalId, traitType)
    }
    if (!traitData.action) {
      throw new ActionCheckError(`traitActivateRequest@Game(${gameId})`, 'Animal(%s):Trait(%s) is not active', animalId, traitType)
    }
    if (traitData.checkAction && !traitData.checkAction(game, sourceAnimal)) {
      throw new ActionCheckError(`traitActivateRequest@Game(${gameId})`, 'Animal(%s):Trait(%s) checkAction failed', animalId, traitType)
    }
    if (traitData.targetType !== null) {
      if (traitData.targetType === TRAIT_TARGET_TYPE.ANIMAL) {
        if (animalId === targetId) {
          throw new ActionCheckError(`traitActivateRequest@Game(${gameId})`, 'Animal(%s):Trait(%s) cant target self', animalId, traitType)
        }
        const {playerId, animalIndex} = game.locateAnimal(targetId);
        if (playerId === null || animalIndex < 0) {
          throw new ActionCheckError(`traitActivateRequest@Game(${gameId})`, 'Animal(%s):Trait(%s) cant locate Animal(%s)', animalId, traitType, targetId)
        }
        const targetAnimal = game.getPlayerAnimal(playerId, animalIndex);
        if (!targetAnimal) {
          throw new ActionCheckError(`traitActivateRequest@Game(${gameId})`, 'Animal(%s):Trait(%s) cant locate Animal(%s)', animalId, traitType, targetId)
        }
        if (traitData.checkTarget && !traitData.checkTarget(game, sourceAnimal, targetAnimal)) {
          throw new ActionCheckError(`traitActivateRequest@Game(${gameId})`, 'Animal(%s):Trait(%s) checkTarget failed', animalId, traitType)
        }
        if (traitData.cooldowns) {
          traitData.cooldowns.forEach(([link, place, duration]) => {
            const placeId = (place === TRAIT_COOLDOWN_PLACE.PLAYER
              ? userId
              : sourceAnimal.id);
            dispatch(server$startCooldown(game.id, link, duration, place, placeId));
          })
        }
        dispatch(traitData.action({
          game: game
          , sourcePlayerId: userId
          , sourceAnimal: sourceAnimal
          , targetPlayerId: playerId
          , targetAnimal: targetAnimal
        }));
      }
    }
  }
};

export const traitServerToClient = {
  traitMoveFood: ({gameId, animalId, amount, sourceType, sourceId}) => traitMoveFood(gameId, animalId, amount, sourceType, sourceId)
  , executeFeeding: ({gameId, actionsList}) => client$executeFeeding(gameId, actionsList)
  , startCooldown: ({gameId, link, duration, place, placeId}) => startCooldown(gameId, link, duration, place, placeId)
  , traitKillAnimal: ({gameId, sourcePlayerId, sourceAnimalId, targetPlayerId, targetAnimalId}) =>
    traitKillAnimal(gameId, sourcePlayerId, sourceAnimalId, targetPlayerId, targetAnimalId)
};