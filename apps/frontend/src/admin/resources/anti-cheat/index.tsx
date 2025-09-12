import React from 'react'
import { Resource } from 'react-admin'

export const AntiCheatAdmin = () => (
  <Resource
    name="user-devices"
    list={require('./AntiCheatList').AntiCheatList}
  />
)